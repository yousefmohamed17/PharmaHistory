from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import re
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

app = FastAPI(title="PharmaHistory AI Microservice")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# تحميل داتا سيت الأدوية المصرية
df = pd.read_csv("egyptian-drugs.csv").fillna("")
df["combined_features"] = df["drug_class"].astype(str) + " " + df["scientific_name"].astype(str)

vectorizer = TfidfVectorizer(stop_words="english")
tfidf_matrix = vectorizer.fit_transform(df["combined_features"])

# الأملاح الدوائية الشائعة التي تُحذف للوصول للمادة الفعالة الأساسية
SALT_WORDS = {
    "POTASSIUM", "SODIUM", "HCL", "HYDROCHLORIDE", "TRIHYDRATE",
    "DIHYDRATE", "ANHYDROUS", "SULFATE", "MALEATE", "TARTRATE",
    "PHOSPHATE", "ACETATE", "CALCIUM", "MAGNESIUM", "CITRATE"
}

# مرادفات وعائلات دوائية متشابهة
DRUG_SYNONYMS = {
    "ACETAMINOPHEN": "PARACETAMOL",
    "ACETYLSALICYLIC": "ASPIRIN",
    "AMOXICILLIN": "PENICILLIN",
    "AMPICILLIN": "PENICILLIN",
}

# قاموس التعارضات الدوائية المنطقية (Drug-Drug Interactions)
KNOWN_INTERACTIONS = {
    "ASPIRIN": ["IBUPROFEN", "DICLOFENAC", "KETOPROFEN", "NAPROXEN", "WARFARIN"],
    "IBUPROFEN": ["ASPIRIN", "DICLOFENAC", "NAPROXEN"],
    "DICLOFENAC": ["ASPIRIN", "IBUPROFEN", "NAPROXEN"],
    "PARACETAMOL": ["PARACETAMOL"],
    "PENICILLIN": ["METHOTREXATE", "TETRACYCLINE"],
}

class MedicationHistoryItem(BaseModel):
    commercial_name_en: str
    scientific_name: Optional[str] = ""
    drug_class: Optional[str] = ""
    had_side_effects: bool = False
    side_effect_notes: Optional[str] = ""

class AnalyzeRequest(BaseModel):
    drug_name_en: str
    scientific_name: Optional[str] = ""
    drug_class: Optional[str] = ""
    known_allergies: Optional[str] = ""
    history: List[MedicationHistoryItem] = []

def normalize_ingredient(raw: str) -> str:
    words = [w for w in re.split(r"[^A-Z0-9]+", raw.upper()) if len(w) > 2 and w not in SALT_WORDS]
    if not words:
        return ""
    base = words[0]
    return DRUG_SYNONYMS.get(base, base)

def extract_ingredients(sci_name: str) -> set:
    if not sci_name:
        return set()
    parts = re.split(r"[+/,()]+", sci_name.upper())
    ingredients = set()
    for p in parts:
        norm = normalize_ingredient(p.strip())
        if norm:
            ingredients.add(norm)
    return ingredients

def classify_drug(drug_class: str, scientific_name: str) -> str:
    text = f"{drug_class} {scientific_name}".upper()
    if any(k in text for k in ["COLD", "FLU", "CHLORPHENIRAMINE", "PSEUDOEPHEDRINE"]):
        return "أدوية البرد والإنفلونزا (Cold & Flu)"
    if any(k in text for k in ["ALLERGY", "ANTIHISTAMINE", "CETIRIZINE", "LORATADINE"]):
        return "أدوية الحساسية (Anti-Allergic)"
    if any(k in text for k in ["ANALGESIC", "PAIN", "NSAID", "PARACETAMOL", "IBUPROFEN", "DICLOFENAC"]):
        return "مسكنات ومضادات التهاب (Analgesic / Anti-inflammatory)"
    if any(k in text for k in ["ANTIBIOTIC", "AMOXICILLIN", "AZITHROMYCIN", "CEPHALOSPORIN", "PENICILLIN"]):
        return "مضادات حيوية (Antibiotic)"
    if any(k in text for k in ["VITAMIN", "ANTIOXIDANT", "SUPPLEMENT"]):
        return "فيتامينات ومكملات غذائية (Vitamins)"
    if any(k in text for k in ["DIABETIC", "INSULIN", "METFORMIN"]):
        return "أدوية السكري (Anti-Diabetic)"
    return f"تصنيف علاجي ({drug_class or 'General'})"

def get_safe_alternatives(drug_class: str, forbidden_ingredients: set, top_n: int = 4):
    if not drug_class:
        return []
    query_vec = vectorizer.transform([drug_class])
    sim_scores = cosine_similarity(query_vec, tfidf_matrix).flatten()
    top_indices = sim_scores.argsort()[::-1][:150]

    alternatives = []
    seen_names = set()
    for idx in top_indices:
        row = df.iloc[idx]
        row_ingredients = extract_ingredients(str(row["scientific_name"]))
        if not row_ingredients or forbidden_ingredients.intersection(row_ingredients):
            continue
        name = str(row["commercial_name_en"]).strip()
        if name and name not in seen_names:
            seen_names.add(name)
            alternatives.append({
                "commercial_name_en": name,
                "commercial_name_ar": str(row["commercial_name_ar"]).strip(),
                "scientific_name": str(row["scientific_name"]).strip(),
                "drug_class": str(row["drug_class"]).strip(),
                "price_egp": row["price_egp"],
                "similarity_score": round(float(sim_scores[idx]) * 100, 1)
            })
        if len(alternatives) >= top_n:
            break
    return alternatives

@app.post("/analyze")
def analyze_prescription(req: AnalyzeRequest):
    classification = classify_drug(req.drug_class or "", req.scientific_name or "")
    new_ingredients = extract_ingredients(req.scientific_name or "")
    warnings = []
    forbidden = set(new_ingredients)

    # 1. فحص الحساسية المسجلة في ملف المريض
    if req.known_allergies:
        allergy_set = extract_ingredients(req.known_allergies)
        matched_allergies = new_ingredients.intersection(allergy_set)
        for ing in matched_allergies:
            warnings.append(f"تحذير حساسية خطير: المريض لديه حساسية مسجلة من ({ing}) الموجودة في هذا الدواء!")

    # 2. فحص تاريخ المريض الدوائي والأدوية المضافة في الفاتورة
    for item in req.history:
        hist_ingredients = extract_ingredients(item.scientific_name or "")
        overlap = new_ingredients.intersection(hist_ingredients)

        if item.had_side_effects and overlap:
            notes = item.side_effect_notes or "آثار جانبية سابقة"
            warnings.append(
                f"خطر تكرار أثر جانبي: المريض سبق وتضرر من ({item.commercial_name_en}) لنفس المادة ({', '.join(overlap)}) — السبب: {notes}."
            )
        elif overlap:
            warnings.append(
                f"تنبيه تكرار مادة فعالة: المريض مسجل له ({item.commercial_name_en}) ويحتوي على نفس المادة ({', '.join(overlap)})."
            )

        for new_ing in new_ingredients:
            conflicts = KNOWN_INTERACTIONS.get(new_ing, [])
            for h_ing in hist_ingredients:
                if h_ing in conflicts and new_ing != h_ing:
                    warnings.append(
                        f"تعارض دوائي منطقي: مادة ({new_ing}) تتعارض طبياً مع ({h_ing}) الموجودة في ({item.commercial_name_en})."
                    )

    # إزالة التكرار من قائمة التحذيرات
    warnings = list(dict.fromkeys(warnings))
    has_conflict = len(warnings) > 0
    alternatives = get_safe_alternatives(req.drug_class or "", forbidden) if has_conflict else []

    return {
        "drug_name": req.drug_name_en,
        "ai_classification": classification,
        "has_conflict": has_conflict,
        "warnings": warnings,
        "safe_alternatives": alternatives
    }