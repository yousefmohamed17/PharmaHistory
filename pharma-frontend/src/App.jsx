import React, { useState, useEffect } from 'react';
import {
  Search, UserPlus, Pill, AlertTriangle, CheckCircle, ShieldAlert,
  Sparkles, LogOut, Clock, PlusCircle, Phone, Package,
  Users, Receipt, ShoppingCart, Trash2, Printer, Edit3,
  ChevronRight, ChevronLeft, Plus, Minus, Lock, X
} from 'lucide-react';

// ============================================================================
// 1. إعدادات الاتصال بالسيرفرات والثوابت العامة (API Configuration & Constants)
// ============================================================================
// يقرأ الروابط من ملف (.env) عند الرفع أونلاين، ويعود تلقائياً للروابط المحلية أثناء التطوير
const LARAVEL_API = import.meta.env.VITE_LARAVEL_API || 'http://127.0.0.1:8000/api';
const AI_API = import.meta.env.VITE_AI_API || 'http://127.0.0.1:8001';

// القيم الافتراضية للنوافذ المنبثقة (Modals) لتسهيل إعادة تهيئتها (Reset)
const INITIAL_NEW_PATIENT = {
  name: '',
  national_id: '',
  age: '',
  phone: '',
  known_allergies: '',
};

const INITIAL_NEW_DRUG = {
  commercial_name_en: '',
  commercial_name_ar: '',
  scientific_name: '',
  manufacturer: '',
  drug_class: '',
  route: 'ORAL',
  price_egp: '',
  stock_quantity: 50,
};

// أرقام قومية جاهزة للتجربة السريعة أثناء العرض والمناقشة
const DEMO_PATIENTS = [
  { id: '29901011234567', label: 'حساسية + أثر جانبي' },
  { id: '29505057654321', label: 'بياخد أسبرين سيولة' },
  { id: '29208151122334', label: 'حساسية DICLOFENAC' },
  { id: '30103209876543', label: 'مريض سليم للفاتورة' },
];

// ============================================================================
// 2. دوال مساعدة نقية (Pure Helper Functions)
// ============================================================================
/**
 * تنسيق المبالغ المالية بشكل موحد (مثال: 125.50 ج.م)
 */
const formatPrice = (value) => `${Number(value || 0).toFixed(2)} ج.م`;

/**
 * تنسيق اسم الصيدلي للعرض في الهيدر والفواتير
 */
const formatPharmacistDisplayName = (rawName = '') => {
  const cleanName = rawName.trim();
  return cleanName.toLowerCase() === 'yousef' ? 'يوسف' : cleanName;
};

export default function App() {
  // ==========================================================================
  // 3. إدارة الحالات (Application State) مقسمة حسب كل وحدة في النظام
  // ==========================================================================

  // --- أ) حالة تسجيل الدخول والتنقل بين الصفحات ---
  const [pharmacist, setPharmacist] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState('pos'); // 'pos' | 'inventory' | 'patients' | 'invoices'
  const [statusMessage, setStatusMessage] = useState('');

  // --- ب) حالة المريض النشط والبحث بالرقم القومي ---
  const [nationalIdInput, setNationalIdInput] = useState('');
  const [patient, setPatient] = useState(null);
  const [patientNotFound, setPatientNotFound] = useState(false);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [newPatient, setNewPatient] = useState(INITIAL_NEW_PATIENT);

  // --- ج) حالة نافذة إضافة حساسية دوائية للمريض ---
  const [showAllergyModal, setShowAllergyModal] = useState(false);
  const [allergyDrugQuery, setAllergyDrugQuery] = useState('');
  const [allergyDrugResults, setAllergyDrugResults] = useState([]);

  // --- د) حالة كتالوج الأدوية والمخزن ---
  const [drugSearch, setDrugSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [drugClasses, setDrugClasses] = useState([]);
  const [drugsPage, setDrugsPage] = useState({ data: [], current_page: 1, last_page: 1, total: 0 });
  const [totalCatalogDrugs, setTotalCatalogDrugs] = useState(0);
  const [showAddDrugModal, setShowAddDrugModal] = useState(false);
  const [newDrugForm, setNewDrugForm] = useState(INITIAL_NEW_DRUG);
  const [editingDrug, setEditingDrug] = useState(null);

  // --- هـ) حالة الفحص الذكي (AI Check) وسلة الفاتورة الحالية ---
  const [selectedDrug, setSelectedDrug] = useState(null);
  const [dosage, setDosage] = useState('قرص مرتين يومياً بعد الأكل');
  const [quantity, setQuantity] = useState(1);
  const [aiResult, setAiResult] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [printedInvoice, setPrintedInvoice] = useState(null);

  // --- و) حالة سجلات كل المرضى والفواتير ---
  const [allPatients, setAllPatients] = useState([]);
  const [patientsSearch, setPatientsSearch] = useState('');
  const [invoicesList, setInvoicesList] = useState([]);

  // إظهار شريط تنبيه علوي مؤقت لمدة 3.5 ثوانٍ
  const notify = (message) => {
    setStatusMessage(message);
    setTimeout(() => setStatusMessage(''), 3500);
  };

  // إعادة تهيئة شاشة الصرف عند تغيير المريض أو مسحه
  const resetPosSession = () => {
    setSelectedDrug(null);
    setAiResult(null);
    setCart([]);
    setDiscount(0);
  };

  // ==========================================================================
  // 4. جلب البيانات والتأثيرات الجانبية (Data Fetching & Side Effects)
  // ==========================================================================

  // جلب قائمة التصنيفات العلاجية للأدوية مرة واحدة بعد تسجيل الدخول
  useEffect(() => {
    if (!pharmacist) return;
    fetch(`${LARAVEL_API}/drug-classes`)
      .then((res) => res.json())
      .then((data) => setDrugClasses(data))
      .catch(() => console.error('تعذر تحميل التصنيفات العلاجية'));
  }, [pharmacist]);

  // دالة جلب الأدوية مع دعم التصفح (Pagination) والبحث والفلترة
  const fetchDrugs = (page = 1) => {
    const params = new URLSearchParams({
      page,
      per_page: 30,
      search: drugSearch,
      drug_class: selectedClass,
      low_stock: lowStockOnly ? '1' : '0',
    });

    fetch(`${LARAVEL_API}/drugs?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setDrugsPage(data);
        // حفظ العدد الكلي لقاعدة الأدوية عند عدم وجود فلاتر
        if (!drugSearch && !selectedClass && !lowStockOnly) {
          setTotalCatalogDrugs(data.total);
        }
      })
      .catch(() => console.error('تأكد من تشغيل سيرفر Laravel على بورت 8000'));
  };

  // البحث في الأدوية مع تأخير بسيط (Debounce 250ms) لتقليل الضغط على السيرفر
  useEffect(() => {
    if (!pharmacist) return;
    const timer = setTimeout(() => fetchDrugs(1), 250);
    return () => clearTimeout(timer);
  }, [drugSearch, selectedClass, lowStockOnly, pharmacist]);

  // البحث اللحظي في الأدوية داخل نافذة إضافة حساسية للمريض
  useEffect(() => {
    if (!showAllergyModal) return;
    const timer = setTimeout(() => {
      fetch(`${LARAVEL_API}/drugs?search=${encodeURIComponent(allergyDrugQuery)}&per_page=15`)
        .then((res) => res.json())
        .then((data) => setAllergyDrugResults(data.data || []))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [allergyDrugQuery, showAllergyModal]);

  // جلب سجل جميع المرضى عند فتح تبويب "سجل كل المرضى"
  const fetchAllPatients = (query = '') => {
    fetch(`${LARAVEL_API}/patients?search=${encodeURIComponent(query)}`)
      .then((res) => res.json())
      .then((data) => setAllPatients(data))
      .catch(() => {});
  };

  useEffect(() => {
    if (pharmacist && activeTab === 'patients') {
      const timer = setTimeout(() => fetchAllPatients(patientsSearch), 250);
      return () => clearTimeout(timer);
    }
  }, [patientsSearch, activeTab, pharmacist]);

  // جلب سجل الفواتير عند فتح تبويب "الفواتير والمبيعات"
  const fetchInvoices = () => {
    fetch(`${LARAVEL_API}/invoices`)
      .then((res) => res.json())
      .then((data) => setInvoicesList(data))
      .catch(() => {});
  };

  useEffect(() => {
    if (pharmacist && activeTab === 'invoices') {
      fetchInvoices();
    }
  }, [activeTab, pharmacist]);

  // ==========================================================================
  // 5. معالجات الأحداث (Event Handlers)
  // ==========================================================================

  // --- أ) تسجيل الدخول ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      const res = await fetch(`${LARAVEL_API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();

      if (res.ok) {
        setPharmacist(formatPharmacistDisplayName(data.user?.name));
      } else {
        setLoginError(data.message || 'اسم المستخدم أو كلمة المرور غير صحيحة');
      }
    } catch {
      setLoginError('تعذر الاتصال بالسيرفر — تأكد من تشغيل Laravel');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // --- ب) البحث عن مريض بالرقم القومي (14 رقم) ---
  const performPatientSearch = async (idValue) => {
    const cleanId = idValue.trim();
    if (cleanId.length !== 14) return;

    setPatientNotFound(false);
    resetPosSession();

    try {
      const res = await fetch(`${LARAVEL_API}/patients/${cleanId}`);
      if (res.status === 404) {
        setPatient(null);
        setPatientNotFound(true);
        setNewPatient({ ...INITIAL_NEW_PATIENT, national_id: cleanId });
      } else {
        const data = await res.json();
        setPatient(data.patient);
        setPatientNotFound(false);
      }
    } catch {
      alert('تأكد من تشغيل سيرفر Laravel');
    }
  };

  // مراقبة الكتابة أو المسح في خانة الرقم القومي
  const handleNationalIdChange = (e) => {
    // السماح بالأرقام فقط بحد أقصى 14 رقماً
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 14);
    setNationalIdInput(digitsOnly);

    // إذا تم مسح أو تعديل الرقم القومي عن المريض المفتوح حالياً، يتم إخفاء ملفه فوراً
    if (patient && digitsOnly !== patient.national_id) {
      setPatient(null);
      resetPosSession();
    }

    if (digitsOnly.length < 14) {
      setPatientNotFound(false);
    }

    // البحث التلقائي فور اكتمال الـ 14 رقماً
    if (digitsOnly.length === 14) {
      performPatientSearch(digitsOnly);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (nationalIdInput.length !== 14) {
      alert('يرجى إدخال 14 رقم للبطاقة الشخصية');
      return;
    }
    performPatientSearch(nationalIdInput);
  };

  // فتح ملف مريض مباشرة في شاشة الصرف
  const openPatientInPos = (selectedPatient) => {
    setPatient(selectedPatient);
    setNationalIdInput(selectedPatient.national_id);
    setPatientNotFound(false);
    resetPosSession();
    setActiveTab('pos');
  };

  // --- ج) تسجيل مريض جديد في قاعدة البيانات ---
  const handleCreatePatient = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${LARAVEL_API}/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(newPatient),
      });
      const data = await res.json();

      if (res.ok) {
        setPatient(data.patient);
        setNationalIdInput(data.patient.national_id);
        setPatientNotFound(false);
        setShowNewPatientModal(false);
        setNewPatient(INITIAL_NEW_PATIENT);
        fetchAllPatients(patientsSearch);
        notify('تم تسجيل المريض الجديد وفتح ملفه بنجاح');
      } else {
        alert(data.message || 'تأكد أن الرقم القومي 14 رقم وغير مسجل مسبقاً');
      }
    } catch {
      alert('حدث خطأ أثناء الاتصال بالسيرفر');
    }
  };

  // --- د) تسجيل حساسية دوائية للمريض باختيار الدواء من القائمة ---
  const handleSelectDrugForAllergy = async (drug) => {
    if (!patient) return;
    // استخراج المادة الفعالة للدواء لحفظها في ملف المريض
    const activeIngredient = (drug.scientific_name || drug.commercial_name_en || '').trim();
    if (!activeIngredient) return;

    try {
      const res = await fetch(`${LARAVEL_API}/patients/${patient.id}/allergies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ allergy: activeIngredient }),
      });
      const data = await res.json();

      if (res.ok) {
        setPatient(data.patient);
        setShowAllergyModal(false);
        setAllergyDrugQuery('');
        notify(`تم تسجيل حساسية المريض من المادة الفعالة: ${activeIngredient}`);

        // إعادة فحص الدواء المختار حالياً في الفحص الذكي لتطبيق الحساسية الجديدة فوراً
        if (selectedDrug) {
          handleSelectDrugForCheck(selectedDrug, data.patient);
        }
      }
    } catch {
      alert('حدث خطأ أثناء تسجيل الحساسية');
    }
  };

  // --- هـ) الفحص الذكي بالذكاء الاصطناعي (AI Microservice) ---
  const handleSelectDrugForCheck = async (drug, overridePatient = null) => {
    const activePatient = overridePatient || patient;
    if (!activePatient) {
      alert('يرجى تحديد المريض بالرقم القومي أولاً قبل اختيار الدواء!');
      return;
    }

    setSelectedDrug(drug);
    setQuantity(1);
    setLoadingAi(true);
    setAiResult(null);

    // 1. تجميع التاريخ الدوائي السابق للمريض
    const pastHistory = (activePatient.medications || []).map((med) => ({
      commercial_name_en: med.drug?.commercial_name_en || '',
      scientific_name: med.drug?.scientific_name || '',
      drug_class: med.drug?.drug_class || '',
      had_side_effects: Boolean(med.had_side_effects),
      side_effect_notes: med.side_effect_notes || '',
    }));

    // 2. تجميع الأدوية المضافة حالياً في الفاتورة لفحص التعارض بينها وبين الدواء الجديد
    const currentCartItems = cart.map((item) => ({
      commercial_name_en: `${item.drug.commercial_name_en} (في الفاتورة الحالية)`,
      scientific_name: item.drug.scientific_name || '',
      drug_class: item.drug.drug_class || '',
      had_side_effects: false,
      side_effect_notes: '',
    }));

    try {
      const res = await fetch(`${AI_API}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drug_name_en: drug.commercial_name_en,
          scientific_name: drug.scientific_name || '',
          drug_class: drug.drug_class || '',
          known_allergies: activePatient.known_allergies || '',
          history: [...pastHistory, ...currentCartItems],
        }),
      });
      const data = await res.json();
      setAiResult(data);
    } catch {
      alert('تأكد من تشغيل سيرفر الذكاء الاصطناعي Python على بورت 8001');
    } finally {
      setLoadingAi(false);
    }
  };

  // --- و) إدارة سلة الفاتورة (إضافة، تعديل الكمية + و -، حذف، إصدار فاتورة) ---
  const handleAddToCart = () => {
    if (!patient || !selectedDrug) return;

    const qtyToAdd = Math.max(1, Number(quantity));
    const existingIndex = cart.findIndex((item) => item.drug.id === selectedDrug.id);
    const currentInCart = existingIndex > -1 ? cart[existingIndex].quantity : 0;

    // التحقق من توافر الرصيد في المخزن
    if (currentInCart + qtyToAdd > selectedDrug.stock_quantity) {
      alert(`الكمية المتاحة في المخزن (${selectedDrug.stock_quantity}) علبة فقط!`);
      return;
    }

    if (existingIndex > -1) {
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += qtyToAdd;
      setCart(updatedCart);
    } else {
      setCart([...cart, { drug: selectedDrug, quantity: qtyToAdd, dosage }]);
    }

    setSelectedDrug(null);
    setAiResult(null);
    notify(`تم إضافة (${qtyToAdd}) علبة إلى فاتورة ${patient.name}`);
  };

  const updateCartQuantity = (drugId, delta) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.drug.id !== drugId) return item;
          const nextQty = item.quantity + delta;
          if (nextQty > item.drug.stock_quantity) {
            alert(`الحد الأقصى المتاح في المخزن هو ${item.drug.stock_quantity} علبة`);
            return item;
          }
          return { ...item, quantity: nextQty };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (drugId) => {
    setCart((prevCart) => prevCart.filter((item) => item.drug.id !== drugId));
  };

  // حسابات إجمالي الفاتورة
  const cartSubtotal = cart.reduce(
    (sum, item) => sum + Number(item.drug.price_egp || 0) * item.quantity,
    0
  );
  const cartTotal = Math.max(0, cartSubtotal - Number(discount || 0));

  // إصدار الفاتورة النهائية وخصم الكميات من المخزن وتسجيلها في تاريخ المريض
  const handleCheckoutInvoice = async () => {
    if (!patient) {
      alert('يرجى تحديد المريض بالرقم القومي أولاً قبل إصدار الفاتورة');
      return;
    }
    if (cart.length === 0) return;

    try {
      const res = await fetch(`${LARAVEL_API}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          patient_id: patient.id,
          pharmacist_name: pharmacist,
          discount: Number(discount || 0),
          items: cart.map((item) => ({
            drug_id: item.drug.id,
            quantity: item.quantity,
            dosage: item.dosage,
          })),
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setPatient(data.patient);
        setPrintedInvoice(data.invoice);
        setCart([]);
        setDiscount(0);
        fetchDrugs(drugsPage.current_page);
        notify('تم إصدار الفاتورة وخصم الكميات من المخزن بنجاح!');
      }
    } catch {
      alert('حدث خطأ أثناء إصدار الفاتورة');
    }
  };

  // تسجيل أثر جانبي على دواء سابق في سجل المريض
  const handleReportSideEffect = async (medicationId) => {
    const note = prompt('اكتب سبب المشكلة أو الحساسية التي سببها هذا الدواء للمريض:');
    if (!note) return;

    const res = await fetch(`${LARAVEL_API}/medications/${medicationId}/side-effect`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ side_effect_notes: note }),
    });

    if (res.ok) {
      const updated = await fetch(`${LARAVEL_API}/patients/${patient.national_id}`).then((r) => r.json());
      setPatient(updated.patient);
      notify('تم تسجيل تحذير الحساسية على الدواء');
    }
  };

  // --- ز) إدارة المخزن (إضافة دواء جديد / تعديل الكمية والسعر) ---
  const handleAddDrugToInventory = async (e) => {
    e.preventDefault();
    const res = await fetch(`${LARAVEL_API}/drugs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(newDrugForm),
    });

    if (res.ok) {
      setShowAddDrugModal(false);
      setNewDrugForm(INITIAL_NEW_DRUG);
      fetchDrugs(1);
      notify('تم إضافة الدواء الجديد للمخزن بنجاح');
    }
  };

  const handleUpdateStock = async (e) => {
    e.preventDefault();
    if (!editingDrug) return;

    const res = await fetch(`${LARAVEL_API}/drugs/${editingDrug.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        stock_quantity: Number(editingDrug.stock_quantity),
        price_egp: Number(editingDrug.price_egp),
      }),
    });

    if (res.ok) {
      setEditingDrug(null);
      fetchDrugs(drugsPage.current_page);
      notify('تم تحديث رصيد المخزن والسعر بنجاح');
    }
  };

  // ==========================================================================
  // 6. واجهة المستخدم (JSX Rendering)
  // ==========================================================================

  // --------------------------------------------------------------------------
  // الشاشة الأولى: تسجيل دخول الصيدلي (Login Screen)
  // --------------------------------------------------------------------------
  if (!pharmacist) {
    return (
      <div
        dir="rtl"
        className="min-h-screen w-full bg-gradient-to-br from-sky-50 via-white to-emerald-50 flex items-center justify-center p-4"
      >
        <div className="bg-white rounded-3xl shadow-xl border border-sky-100 max-w-md w-full p-8">
          {/* الشعار وعنوان النظام */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-28 h-28 rounded-2xl overflow-hidden shadow-md border-2 border-cyan-200 bg-[#0B1E38] mb-4">
              <img src="/logo.jpg" alt="PharmaHistory Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              Pharma<span className="text-sky-600">History</span> — <span className="text-emerald-600">صيدليتك</span>
            </h1>
            <p className="text-slate-600 text-sm mt-1">
              نظام إدارة الصيدلية والتاريخ الدوائي بالذكاء الاصطناعي
            </p>
          </div>

          {/* رسالة خطأ في حالة بيانات دخول خاطئة */}
          {loginError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold text-center">
              {loginError}
            </div>
          )}

          {/* نموذج تسجيل الدخول */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">اسم المستخدم</label>
              <input
                type="text"
                dir="ltr"
                placeholder="أدخل اسم المستخدم..."
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                className="w-full bg-slate-50 text-slate-900 placeholder-slate-400 border border-slate-300 rounded-xl px-4 py-3 text-sm text-left focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-none transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">كلمة المرور</label>
              <input
                type="password"
                dir="ltr"
                placeholder="••••••••"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full bg-slate-50 text-slate-900 placeholder-slate-400 border border-slate-300 rounded-xl px-4 py-3 text-sm text-left focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-none transition"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-gradient-to-l from-sky-600 to-emerald-500 hover:from-sky-700 hover:to-emerald-600 text-white font-extrabold py-3.5 rounded-xl transition shadow-md cursor-pointer mt-2"
            >
              {isLoggingIn ? 'جاري الدخول...' : 'تسجيل الدخول'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // الشاشة الثانية: لوحة التحكم الرئيسية (Main Dashboard)
  // --------------------------------------------------------------------------
  return (
    <div dir="rtl" className="min-h-screen w-full bg-[#F4F8FB] text-slate-900 flex flex-col">
      {/* الشريط العلوي (Top Header) */}
      <header className="w-full bg-white border-b border-sky-100 px-4 sm:px-6 py-3 shadow-sm sticky top-0 z-20">
        <div className="max-w-[1700px] mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl overflow-hidden bg-[#0B1E38] border border-cyan-300 shadow-sm shrink-0">
              <img src="/logo.jpg" alt="PharmaHistory" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight">
                Pharma<span className="text-sky-600">History</span> — <span className="text-emerald-600">صيدليتك</span>
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                نظام إدارة المخزن والفواتير والتاريخ الدوائي بالـ AI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline-flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl font-bold">
              <Package size={15} /> إجمالي قاعدة الأدوية: {totalCatalogDrugs || drugsPage.total || 0} دواء
            </span>
            <div className="bg-sky-50 border border-sky-200 text-slate-800 text-xs sm:text-sm px-3.5 py-1.5 rounded-xl font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              د. <span className="text-sky-700 font-bold">{pharmacist}</span>
            </div>
            <button
              onClick={() => { setPharmacist(null); setLoginForm({ username: '', password: '' }); }}
              className="flex items-center gap-1.5 text-xs sm:text-sm bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 font-bold px-3.5 py-1.5 rounded-xl transition cursor-pointer"
            >
              <LogOut size={16} /> خروج
            </button>
          </div>
        </div>
      </header>

      {/* شريط الإشعارات المؤقتة */}
      {statusMessage && (
        <div className="bg-gradient-to-l from-sky-600 to-emerald-500 text-white text-center py-2 text-sm font-bold shadow">
          {statusMessage}
        </div>
      )}

      <div className="flex-1 w-full max-w-[1700px] mx-auto flex flex-col lg:flex-row">
        {/* القائمة الجانبية (Sidebar Navigation) */}
        <aside className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-l border-slate-200 p-4 shrink-0">
          <p className="text-[11px] font-extrabold text-slate-400 px-3 mb-2 hidden lg:block">القائمة الرئيسية</p>
          <nav className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-1 gap-2">
            <button
              onClick={() => setActiveTab('pos')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-extrabold transition cursor-pointer ${
                activeTab === 'pos'
                  ? 'bg-gradient-to-l from-sky-600 to-emerald-500 text-white shadow-md'
                  : 'text-slate-700 hover:bg-sky-50'
              }`}
            >
              <Sparkles size={19} />
              <span>الصرف والفحص (AI)</span>
            </button>

            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-extrabold transition cursor-pointer ${
                activeTab === 'inventory'
                  ? 'bg-gradient-to-l from-sky-600 to-emerald-500 text-white shadow-md'
                  : 'text-slate-700 hover:bg-sky-50'
              }`}
            >
              <Package size={19} />
              <span>المخزن وكل الأدوية</span>
            </button>

            <button
              onClick={() => setActiveTab('patients')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-extrabold transition cursor-pointer ${
                activeTab === 'patients'
                  ? 'bg-gradient-to-l from-sky-600 to-emerald-500 text-white shadow-md'
                  : 'text-slate-700 hover:bg-sky-50'
              }`}
            >
              <Users size={19} />
              <span>سجل كل المرضى</span>
            </button>

            <button
              onClick={() => setActiveTab('invoices')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-extrabold transition cursor-pointer ${
                activeTab === 'invoices'
                  ? 'bg-gradient-to-l from-sky-600 to-emerald-500 text-white shadow-md'
                  : 'text-slate-700 hover:bg-sky-50'
              }`}
            >
              <Receipt size={19} />
              <span>الفواتير والمبيعات</span>
            </button>
          </nav>

          {/* اختصارات سريعة للأرقام القومية التجريبية */}
          <div className="hidden lg:block mt-8 p-4 bg-sky-50/70 border border-sky-100 rounded-2xl">
            <h4 className="text-xs font-extrabold text-sky-900 mb-2">🧪 أرقام قومية جاهزة للتجربة:</h4>
            <ul className="text-[11px] text-slate-700 space-y-1.5 font-semibold">
              {DEMO_PATIENTS.map((demo) => (
                <li
                  key={demo.id}
                  className="cursor-pointer hover:text-sky-700 transition"
                  onClick={() => {
                    setNationalIdInput(demo.id);
                    performPatientSearch(demo.id);
                    setActiveTab('pos');
                  }}
                >
                  • <b>{demo.id}</b> ({demo.label})
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* ================================================================== */}
        {/* منطقة المحتوى المتغيرة حسب التبويب النشط (Main Content Area)       */}
        {/* ================================================================== */}
        <main className="flex-1 p-4 sm:p-6">

          {/* ---------------------------------------------------------------- */}
          {/* التبويب الأول: شاشة الصرف والفحص الذكي (POS & AI Check)           */}
          {/* ---------------------------------------------------------------- */}
          {activeTab === 'pos' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">

              {/* العمود الأول: بيانات المريض والبحث بالرقم القومي */}
              <section className="xl:col-span-4 space-y-5">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 space-y-3">
                  <div className="flex justify-between items-center">
                    <h2 className="font-extrabold text-base flex items-center gap-2 text-slate-900">
                      <Search size={18} className="text-sky-600" /> بيانات المريض
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setNewPatient({
                          ...INITIAL_NEW_PATIENT,
                          national_id: nationalIdInput.length === 14 ? nationalIdInput : '',
                        });
                        setShowNewPatientModal(true);
                      }}
                      className="bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <UserPlus size={15} /> إضافة مريض جديد
                    </button>
                  </div>

                  <form onSubmit={handleSearchSubmit} className="flex gap-2">
                    <input
                      type="text"
                      maxLength={14}
                      placeholder="اكتب الـ 14 رقم للبطاقة..."
                      value={nationalIdInput}
                      onChange={handleNationalIdChange}
                      className="flex-1 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                    />
                    <button
                      type="submit"
                      className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer"
                    >
                      بحث
                    </button>
                  </form>
                  <p className="text-[11px] text-slate-400">
                    سيتم عرض ملف المريض تلقائياً فور اكتمال الـ 14 رقم، وإخفاؤه عند مسح الرقم.
                  </p>

                  {/* تنبيه عدم وجود المريض مع زر تسجيله فوراً */}
                  {patientNotFound && (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-amber-900 text-xs font-bold flex items-center gap-1.5">
                        <AlertTriangle size={16} /> لا يوجد مريض مسجل بهذا الرقم القومي!
                      </p>
                      <button
                        onClick={() => setShowNewPatientModal(true)}
                        className="mt-2.5 w-full bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <UserPlus size={16} /> تسجيل مريض جديد بهذا الرقم
                      </button>
                    </div>
                  )}
                </div>

                {/* بطاقة ملف المريض النشط والحساسيات والتاريخ الدوائي */}
                {patient && (
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
                    <div className="border-b pb-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">
                          ملف نشط
                        </span>
                        <span className="text-xs text-slate-500 font-bold">السن: {patient.age || '-'}</span>
                      </div>
                      <h3 className="text-base font-extrabold text-slate-900 mt-1.5">{patient.name}</h3>
                      <p className="text-xs text-slate-600">البطاقة: <b>{patient.national_id}</b></p>

                      {/* قسم الحساسيات الدوائية */}
                      <div className="mt-3 p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-extrabold text-rose-900">⚠️ الحساسيات الدوائية المسجلة:</span>
                          <button
                            type="button"
                            onClick={() => { setAllergyDrugQuery(''); setShowAllergyModal(true); }}
                            className="bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={13} /> إضافة حساسية لدواء
                          </button>
                        </div>

                        {patient.known_allergies ? (
                          <p className="text-xs font-extrabold text-rose-700 bg-white px-2.5 py-1.5 rounded-lg border border-rose-200">
                            {patient.known_allergies}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-500">لا توجد حساسيات مسجلة لهذا المريض.</p>
                        )}
                      </div>
                    </div>

                    {/* قائمة الأدوية السابقة للمريض */}
                    <div>
                      <h4 className="font-extrabold text-xs mb-2 flex items-center gap-1.5 text-slate-700">
                        <Clock size={14} className="text-sky-600" /> التاريخ الدوائي السابق ({patient.medications?.length || 0})
                      </h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto pl-1">
                        {patient.medications?.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-3">لا توجد أدوية سابقة.</p>
                        ) : (
                          patient.medications.map((med) => (
                            <div
                              key={med.id}
                              className={`p-2.5 rounded-xl border text-xs ${
                                med.had_side_effects ? 'bg-rose-50 border-rose-300' : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <div className="flex justify-between font-bold">
                                <span>{med.drug?.commercial_name_en}</span>
                                <span className="text-slate-400 text-[11px]">{med.dispensed_date}</span>
                              </div>
                              <p className="text-[11px] text-slate-600 mt-0.5">
                                المادة: {med.drug?.scientific_name || '-'}
                              </p>
                              {med.had_side_effects ? (
                                <p className="mt-1 text-rose-700 font-bold text-[11px]">🚫 {med.side_effect_notes}</p>
                              ) : (
                                <button
                                  onClick={() => handleReportSideEffect(med.id)}
                                  className="mt-1 text-[11px] text-rose-600 hover:underline font-bold cursor-pointer"
                                >
                                  + تسجيل أثر جانبي / حساسية
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* العمود الثاني: البحث واختيار الدواء (مغلق لحين اختيار مريض) */}
              <section className="xl:col-span-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 relative">
                <h2 className="font-extrabold text-base mb-1 flex items-center gap-2">
                  <Pill size={18} className="text-emerald-600" /> البحث واختيار الدواء
                </h2>
                <p className="text-xs text-slate-500 mb-3">اختر الدواء لفحصه بالذكاء الاصطناعي وإضافته للفاتورة</p>

                {!patient && (
                  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs font-extrabold text-amber-900">
                    <Lock size={16} className="text-amber-600 shrink-0" />
                    <span>ابحث عن مريض بالرقم القومي أو أضف مريضاً جديداً أولاً لتفعيل اختيار الأدوية.</span>
                  </div>
                )}

                <input
                  type="text"
                  disabled={!patient}
                  placeholder={patient ? 'ابحث بالاسم التجاري أو المادة الفعالة...' : 'حدد مريضاً أولاً لتفعيل البحث...'}
                  value={drugSearch}
                  onChange={(e) => setDrugSearch(e.target.value)}
                  className="w-full bg-slate-50 disabled:opacity-60 text-slate-900 border border-slate-300 rounded-xl px-3.5 py-2 text-sm mb-3 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />

                <div className={`space-y-2 max-h-[540px] overflow-y-auto pl-1 ${!patient ? 'opacity-50 pointer-events-none select-none' : ''}`}>
                  {drugsPage.data?.map((drug) => (
                    <div
                      key={drug.id}
                      onClick={() => handleSelectDrugForCheck(drug)}
                      className={`p-3 rounded-xl border cursor-pointer transition ${
                        selectedDrug?.id === drug.id ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:border-cyan-400'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-extrabold text-xs sm:text-sm text-slate-900">{drug.commercial_name_en}</h3>
                        <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-bold shrink-0">
                          {drug.price_egp || 0} ج.م
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 truncate">المادة: {drug.scientific_name || '-'}</p>
                      <div className="flex justify-between items-center mt-1.5">
                        <span className="text-[10px] bg-sky-100 text-sky-800 px-2 py-0.5 rounded font-bold truncate max-w-[180px]">
                          {drug.drug_class || 'عام'}
                        </span>
                        <span className={`text-[11px] font-bold ${drug.stock_quantity > 10 ? 'text-slate-500' : 'text-rose-600'}`}>
                          المخزن: {drug.stock_quantity} علبة
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* العمود الثالث: الفحص الذكي (AI Check) وسلة الفاتورة الحالية */}
              <section className="xl:col-span-4 space-y-5">
                {/* كارت نتيجة الفحص الذكي */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80">
                  <h2 className="font-extrabold text-base mb-3 flex items-center gap-2">
                    <Sparkles size={18} className="text-cyan-600" /> الفحص الذكي (AI Check)
                  </h2>

                  {!patient ? (
                    <div className="text-xs text-slate-500 bg-slate-50 p-5 rounded-xl text-center border border-dashed space-y-1.5">
                      <Lock size={20} className="mx-auto text-slate-400" />
                      <p className="font-bold">بانتظار تحديد المريض</p>
                      <p className="text-[11px]">لا يمكن فحص أو صرف أي دواء قبل فتح ملف المريض بالرقم القومي.</p>
                    </div>
                  ) : !selectedDrug ? (
                    <p className="text-xs text-slate-500 bg-slate-50 p-4 rounded-xl text-center border border-dashed">
                      اضغط على أي دواء من القائمة في المنتصف لتشغيل الفحص الذكي لـ <b>{patient.name}</b>.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 bg-sky-50 rounded-xl border border-sky-200">
                        <h3 className="font-extrabold text-sm text-slate-900">{selectedDrug.commercial_name_en}</h3>
                        <p className="text-xs text-slate-600">
                          السعر: <b>{selectedDrug.price_egp || 0} ج.م</b> | المتاح: <b>{selectedDrug.stock_quantity} علبة</b>
                        </p>
                      </div>

                      {loadingAi && (
                        <p className="text-xs text-cyan-700 font-bold text-center animate-pulse">
                          جاري تحليل التعارضات والحساسيات...
                        </p>
                      )}

                      {aiResult && (
                        <>
                          <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs">
                            <span className="font-bold text-indigo-800">التصنيف: </span>
                            <span className="font-extrabold text-slate-900">{aiResult.ai_classification}</span>
                          </div>

                          {aiResult.has_conflict ? (
                            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl space-y-2">
                              <h4 className="font-extrabold text-xs text-rose-800 flex items-center gap-1">
                                <ShieldAlert size={16} /> تحذير تعارض دوائي / حساسية!
                              </h4>
                              <ul className="list-disc pr-4 text-[11px] text-rose-900 font-bold space-y-1">
                                {aiResult.warnings.map((warning, idx) => (
                                  <li key={idx}>{warning}</li>
                                ))}
                              </ul>

                              {aiResult.safe_alternatives?.length > 0 && (
                                <div className="pt-2 border-t border-rose-200">
                                  <p className="text-[11px] font-extrabold text-emerald-800 mb-1">✨ بدائل آمنة مقترحة:</p>
                                  <div className="space-y-1">
                                    {aiResult.safe_alternatives.map((alt, idx) => (
                                      <div
                                        key={idx}
                                        className="bg-white p-2 rounded-lg border border-emerald-200 text-[11px] flex justify-between items-center"
                                      >
                                        <div>
                                          <p className="font-extrabold">{alt.commercial_name_en}</p>
                                          <p className="text-[10px] text-slate-500">{alt.scientific_name}</p>
                                        </div>
                                        <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                                          {alt.price_egp} ج.م
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-extrabold">
                              <CheckCircle size={17} /> آمن تماماً للإضافة للفاتورة.
                            </div>
                          )}
                        </>
                      )}

                      {/* تحديد الكمية والجرعة قبل الإضافة للسلة */}
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <div>
                          <label className="block text-[11px] font-bold mb-1">الكمية (علبة)</label>
                          <input
                            type="number"
                            min="1"
                            max={selectedDrug.stock_quantity}
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="w-full bg-slate-50 border rounded-xl px-2.5 py-1.5 text-xs font-bold"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[11px] font-bold mb-1">الجرعة</label>
                          <input
                            type="text"
                            value={dosage}
                            onChange={(e) => setDosage(e.target.value)}
                            className="w-full bg-slate-50 border rounded-xl px-2.5 py-1.5 text-xs"
                          />
                        </div>
                      </div>

                      <button
                        onClick={handleAddToCart}
                        className={`w-full text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition ${
                          aiResult?.has_conflict ? 'bg-rose-600 hover:bg-rose-700' : 'bg-sky-600 hover:bg-sky-700'
                        }`}
                      >
                        <PlusCircle size={16} />
                        {aiResult?.has_conflict ? 'إضافة للفاتورة رغم التحذير' : 'إضافة إلى فاتورة المريض'}
                      </button>
                    </div>
                  )}
                </div>

                {/* كارت سلة الفاتورة الحالية (يظهر فقط عند وجود مريض نشط) */}
                {patient && (
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80">
                    <h2 className="font-extrabold text-base mb-3 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <ShoppingCart size={18} className="text-emerald-600" /> فاتورة: {patient.name}
                      </span>
                      <span className="text-xs bg-slate-100 px-2.5 py-1 rounded-lg font-bold">
                        {cart.reduce((sum, item) => sum + item.quantity, 0)} علبة
                      </span>
                    </h2>

                    {cart.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">السلة فارغة — أضف أدوية لإصدار فاتورة.</p>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-2 max-h-56 overflow-y-auto">
                          {cart.map((item) => (
                            <div key={item.drug.id} className="bg-slate-50 p-3 rounded-xl border text-xs space-y-2">
                              <div className="flex justify-between items-start gap-2">
                                <div>
                                  <p className="font-extrabold text-slate-900">{item.drug.commercial_name_en}</p>
                                  <p className="text-[11px] text-slate-500">
                                    سعر العلبة: {formatPrice(item.drug.price_egp)}
                                  </p>
                                </div>
                                <button
                                  onClick={() => removeFromCart(item.drug.id)}
                                  className="text-rose-500 hover:text-rose-700 cursor-pointer"
                                  title="حذف الصنف"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>

                              {/* أزرار التحكم في عدد العلب (+ و -) */}
                              <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/80">
                                <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-1.5 py-0.5">
                                  <button
                                    type="button"
                                    onClick={() => updateCartQuantity(item.drug.id, 1)}
                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                                  >
                                    <Plus size={13} />
                                  </button>
                                  <span className="font-extrabold text-slate-900 min-w-[24px] text-center">
                                    {item.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => updateCartQuantity(item.drug.id, -1)}
                                    className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                  >
                                    <Minus size={13} />
                                  </button>
                                </div>

                                <span className="font-extrabold text-emerald-700 text-sm">
                                  {formatPrice(Number(item.drug.price_egp || 0) * item.quantity)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* ملخص الحسابات والخصم */}
                        <div className="border-t pt-3 space-y-2 text-xs">
                          <div className="flex justify-between text-slate-600 font-bold">
                            <span>المجموع الفرعي:</span>
                            <span>{formatPrice(cartSubtotal)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-600 font-bold">خصم (ج.م):</span>
                            <input
                              type="number"
                              min="0"
                              value={discount}
                              onChange={(e) => setDiscount(e.target.value)}
                              className="w-20 bg-slate-50 border rounded-lg px-2 py-1 text-left font-bold"
                            />
                          </div>
                          <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t">
                            <span>الإجمالي النهائي:</span>
                            <span className="text-emerald-600">{formatPrice(cartTotal)}</span>
                          </div>
                        </div>

                        <button
                          onClick={handleCheckoutInvoice}
                          className="w-full bg-gradient-to-l from-sky-600 to-emerald-500 hover:from-sky-700 hover:to-emerald-600 text-white font-extrabold py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer"
                        >
                          <Receipt size={18} /> إصدار الفاتورة وتأكيد الصرف
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* التبويب الثاني: إدارة المخزن وكل الأدوية (Inventory Management)    */}
          {/* ---------------------------------------------------------------- */}
          {activeTab === 'inventory' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-5">
              <div className="flex flex-wrap justify-between items-center gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                    <Package className="text-sky-600" /> إدارة مخزن الصيدلية (قاعدة الأدوية الكاملة)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    إجمالي النتائج: <b>{drugsPage.total}</b> دواء — عرض صفحة <b>{drugsPage.current_page}</b> من <b>{drugsPage.last_page}</b>
                  </p>
                </div>
                <button
                  onClick={() => setShowAddDrugModal(true)}
                  className="bg-gradient-to-l from-sky-600 to-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-extrabold flex items-center gap-2 shadow cursor-pointer"
                >
                  <PlusCircle size={18} /> إضافة دواء جديد للمخزن
                </button>
              </div>

              {/* أدوات البحث والفلترة */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <input
                  type="text"
                  placeholder="ابحث بالاسم التجاري، العربي، أو المادة الفعالة..."
                  value={drugSearch}
                  onChange={(e) => setDrugSearch(e.target.value)}
                  className="md:col-span-5 bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:bg-white"
                />
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="md:col-span-4 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none"
                >
                  <option value="">كل التصنيفات العلاجية</option>
                  {drugClasses.map((cls, idx) => (
                    <option key={idx} value={cls}>{cls}</option>
                  ))}
                </select>
                <label className="md:col-span-3 flex items-center gap-2 bg-rose-50 border border-rose-200 px-4 py-2.5 rounded-xl text-xs font-extrabold text-rose-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lowStockOnly}
                    onChange={(e) => setLowStockOnly(e.target.checked)}
                  />
                  عرض النواقص فقط (أقل من 10 علب)
                </label>
              </div>

              {/* جدول الأدوية */}
              <div className="overflow-x-auto border rounded-2xl">
                <table className="w-full text-right text-xs sm:text-sm">
                  <thead className="bg-slate-100 text-slate-700 font-extrabold">
                    <tr>
                      <th className="p-3.5">#</th>
                      <th className="p-3.5">الاسم التجاري</th>
                      <th className="p-3.5">المادة الفعالة</th>
                      <th className="p-3.5">التصنيف</th>
                      <th className="p-3.5">السعر</th>
                      <th className="p-3.5">الرصيد بالمخزن</th>
                      <th className="p-3.5">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {drugsPage.data?.map((drug) => (
                      <tr key={drug.id} className="hover:bg-sky-50/40">
                        <td className="p-3.5 text-slate-500 font-bold">{drug.id}</td>
                        <td className="p-3.5">
                          <p className="font-extrabold text-slate-900">{drug.commercial_name_en}</p>
                          <p className="text-xs text-sky-700">{drug.commercial_name_ar}</p>
                        </td>
                        <td className="p-3.5 text-xs text-slate-600 max-w-xs truncate">{drug.scientific_name || '-'}</td>
                        <td className="p-3.5">
                          <span className="text-[11px] bg-sky-100 text-sky-800 px-2.5 py-0.5 rounded-md font-bold">
                            {drug.drug_class || 'عام'}
                          </span>
                        </td>
                        <td className="p-3.5 font-extrabold text-emerald-700">{drug.price_egp || 0} ج.م</td>
                        <td className="p-3.5">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                              drug.stock_quantity <= 10 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-50 text-emerald-800'
                            }`}
                          >
                            {drug.stock_quantity} علبة
                          </span>
                        </td>
                        <td className="p-3.5">
                          <button
                            onClick={() => setEditingDrug(drug)}
                            className="text-sky-600 hover:text-sky-800 font-bold text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 size={14} /> تعديل الرصيد
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* أزرار التنقل بين الصفحات (Pagination) */}
              <div className="flex justify-between items-center pt-2">
                <button
                  disabled={drugsPage.current_page <= 1}
                  onClick={() => fetchDrugs(drugsPage.current_page - 1)}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl border text-xs font-extrabold disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight size={16} /> الصفحة السابقة
                </button>
                <span className="text-xs font-bold text-slate-600">
                  صفحة {drugsPage.current_page} من {drugsPage.last_page}
                </span>
                <button
                  disabled={drugsPage.current_page >= drugsPage.last_page}
                  onClick={() => fetchDrugs(drugsPage.current_page + 1)}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl border text-xs font-extrabold disabled:opacity-40 cursor-pointer"
                >
                  الصفحة التالية <ChevronLeft size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* التبويب الثالث: سجل كل المرضى (Patients Directory)                */}
          {/* ---------------------------------------------------------------- */}
          {activeTab === 'patients' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-5">
              <div className="flex flex-wrap justify-between items-center gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                    <Users className="text-sky-600" /> سجل جميع المرضى ({allPatients.length})
                  </h2>
                  <p className="text-xs text-slate-500">ابحث في كل المرضى المسجلين أو أضف مريضاً جديداً</p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                  <input
                    type="text"
                    placeholder="ابحث بالاسم، الرقم القومي، أو الهاتف..."
                    value={patientsSearch}
                    onChange={(e) => setPatientsSearch(e.target.value)}
                    className="flex-1 sm:w-72 bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:bg-white"
                  />
                  <button
                    onClick={() => {
                      setNewPatient(INITIAL_NEW_PATIENT);
                      setShowNewPatientModal(true);
                    }}
                    className="bg-gradient-to-l from-sky-600 to-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-extrabold flex items-center gap-1.5 shadow cursor-pointer shrink-0"
                  >
                    <UserPlus size={17} /> إضافة مريض جديد
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {allPatients.map((p) => (
                  <div
                    key={p.id}
                    className="border border-slate-200 rounded-2xl p-4 hover:border-sky-400 transition flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <h3 className="font-extrabold text-base text-slate-900">{p.name}</h3>
                        <span className="text-xs bg-sky-50 text-sky-800 px-2.5 py-0.5 rounded-full font-bold">
                          {p.age ? `${p.age} سنة` : 'السن غير مسجل'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">الرقم القومي: <b>{p.national_id}</b></p>
                      {p.phone && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone size={12} /> {p.phone}
                        </p>
                      )}

                      {p.known_allergies && (
                        <p className="mt-2 text-[11px] bg-rose-50 text-rose-800 border border-rose-200 p-2 rounded-lg font-bold">
                          ⚠️ حساسية: {p.known_allergies}
                        </p>
                      )}

                      <p className="mt-2 text-xs text-slate-600 font-semibold">
                        عدد الأدوية في السجل: <b className="text-emerald-700">{p.medications?.length || 0}</b>
                      </p>
                    </div>

                    <button
                      onClick={() => openPatientInPos(p)}
                      className="w-full bg-gradient-to-l from-sky-600 to-emerald-500 text-white py-2 rounded-xl text-xs font-extrabold cursor-pointer"
                    >
                      فتح ملف المريض والصرف
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* التبويب الرابع: سجل الفواتير والمبيعات (Invoices History)          */}
          {/* ---------------------------------------------------------------- */}
          {activeTab === 'invoices' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-5">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                    <Receipt className="text-emerald-600" /> سجل الفواتير والمبيعات ({invoicesList.length})
                  </h2>
                  <p className="text-xs text-slate-500">جميع الفواتير الصادرة من الصيدلية</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl text-sm font-extrabold text-emerald-800">
                  إجمالي المبيعات: {formatPrice(invoicesList.reduce((sum, inv) => sum + Number(inv.total), 0))}
                </div>
              </div>

              {invoicesList.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-12">لا توجد فواتير صادرة حتى الآن.</p>
              ) : (
                <div className="space-y-3">
                  {invoicesList.map((inv) => (
                    <div
                      key={inv.id}
                      className="border border-slate-200 rounded-2xl p-4 flex flex-wrap justify-between items-center gap-4"
                    >
                      <div>
                        <span className="text-xs font-extrabold bg-sky-100 text-sky-800 px-2.5 py-0.5 rounded-lg">
                          {inv.invoice_number}
                        </span>
                        <h3 className="font-extrabold text-sm text-slate-900 mt-1">
                          المريض: {inv.patient_name || 'عميل نقدي'} ({inv.patient_national_id || '-'})
                        </h3>
                        <p className="text-xs text-slate-500">
                          الصيدلي: د. {inv.pharmacist_name} | التاريخ: {inv.created_at}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-left">
                          <p className="text-xs text-slate-500">الإجمالي</p>
                          <p className="text-lg font-extrabold text-emerald-600">{formatPrice(inv.total)}</p>
                        </div>
                        <button
                          onClick={() =>
                            setPrintedInvoice({
                              ...inv,
                              patient: { name: inv.patient_name, national_id: inv.patient_national_id },
                              items: inv.items.map((it) => ({
                                drug: { commercial_name_en: it.commercial_name_en },
                                quantity: it.quantity,
                                unit_price: it.unit_price,
                                total_price: it.total_price,
                              })),
                            })
                          }
                          className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Printer size={15} /> عرض وطباعة
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ==================================================================== */}
      {/* 7. النوافذ المنبثقة (Modals)                                         */}
      {/* ==================================================================== */}

      {/* نافذة 1: إضافة مريض جديد */}
      {showNewPatientModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleCreatePatient}
            className="bg-white rounded-3xl max-w-md w-full p-6 space-y-3.5 shadow-2xl"
          >
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <UserPlus className="text-emerald-600" size={20} /> تسجيل مريض جديد
              </h3>
              <button
                type="button"
                onClick={() => setShowNewPatientModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <input
              type="text"
              placeholder="اسم المريض بالكامل *"
              value={newPatient.name}
              onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm"
              required
            />
            <input
              type="text"
              maxLength={14}
              placeholder="الرقم القومي (14 رقم) *"
              value={newPatient.national_id}
              onChange={(e) => setNewPatient({ ...newPatient, national_id: e.target.value.replace(/\D/g, '') })}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm"
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                placeholder="السن"
                value={newPatient.age}
                onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm"
              />
              <input
                type="text"
                placeholder="رقم الهاتف"
                value={newPatient.phone}
                onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
            <input
              type="text"
              placeholder="حساسية معروفة مسبقاً (اختياري)"
              value={newPatient.known_allergies}
              onChange={(e) => setNewPatient({ ...newPatient, known_allergies: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm"
            />

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 bg-gradient-to-l from-sky-600 to-emerald-500 text-white py-2.5 rounded-xl text-sm font-extrabold cursor-pointer"
              >
                حفظ وفتح الملف
              </button>
              <button
                type="button"
                onClick={() => setShowNewPatientModal(false)}
                className="px-4 py-2.5 rounded-xl border text-sm font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* نافذة 2: اختيار دواء لإضافة حساسية لمادته الفعالة في ملف المريض */}
      {showAllergyModal && patient && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  إضافة حساسية دوائية لـ ({patient.name})
                </h3>
                <p className="text-xs text-slate-500">
                  اختر الدواء الذي سبب حساسية للمريض ليتم حفظ مادته الفعالة تلقائياً
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAllergyModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <input
              type="text"
              autoFocus
              placeholder="اكتب اسم الدواء للبحث (مثل: Augmentin, Cataflam, Aspirin)..."
              value={allergyDrugQuery}
              onChange={(e) => setAllergyDrugQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none"
            />

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {allergyDrugResults.map((drug) => (
                <div
                  key={drug.id}
                  onClick={() => handleSelectDrugForAllergy(drug)}
                  className="p-3 rounded-xl border border-slate-200 hover:border-rose-400 hover:bg-rose-50/50 cursor-pointer transition flex justify-between items-center gap-3"
                >
                  <div>
                    <p className="font-extrabold text-sm text-slate-900">{drug.commercial_name_en}</p>
                    <p className="text-xs text-rose-700 font-bold mt-0.5">
                      المادة الفعالة: {drug.scientific_name || 'غير محددة'}
                    </p>
                  </div>
                  <span className="text-xs bg-rose-100 text-rose-800 px-2.5 py-1 rounded-lg font-extrabold shrink-0">
                    اختيار
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* نافذة 3: إضافة دواء جديد للمخزن */}
      {showAddDrugModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleAddDrugToInventory}
            className="bg-white rounded-3xl max-w-md w-full p-6 space-y-3 shadow-2xl"
          >
            <h3 className="text-lg font-extrabold text-slate-900">إضافة دواء جديد للمخزن</h3>
            <input
              type="text"
              placeholder="الاسم التجاري بالإنجليزية *"
              value={newDrugForm.commercial_name_en}
              onChange={(e) => setNewDrugForm({ ...newDrugForm, commercial_name_en: e.target.value })}
              className="w-full bg-slate-50 border rounded-xl px-3.5 py-2 text-sm"
              required
            />
            <input
              type="text"
              placeholder="الاسم التجاري بالعربية"
              value={newDrugForm.commercial_name_ar}
              onChange={(e) => setNewDrugForm({ ...newDrugForm, commercial_name_ar: e.target.value })}
              className="w-full bg-slate-50 border rounded-xl px-3.5 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="المادة الفعالة (Scientific Name)"
              value={newDrugForm.scientific_name}
              onChange={(e) => setNewDrugForm({ ...newDrugForm, scientific_name: e.target.value })}
              className="w-full bg-slate-50 border rounded-xl px-3.5 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="التصنيف العلاجي (Drug Class)"
              value={newDrugForm.drug_class}
              onChange={(e) => setNewDrugForm({ ...newDrugForm, drug_class: e.target.value })}
              className="w-full bg-slate-50 border rounded-xl px-3.5 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                step="0.01"
                placeholder="السعر (ج.م) *"
                value={newDrugForm.price_egp}
                onChange={(e) => setNewDrugForm({ ...newDrugForm, price_egp: e.target.value })}
                className="w-full bg-slate-50 border rounded-xl px-3.5 py-2 text-sm"
                required
              />
              <input
                type="number"
                placeholder="الكمية بالمخزن *"
                value={newDrugForm.stock_quantity}
                onChange={(e) => setNewDrugForm({ ...newDrugForm, stock_quantity: e.target.value })}
                className="w-full bg-slate-50 border rounded-xl px-3.5 py-2 text-sm"
                required
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-extrabold cursor-pointer"
              >
                حفظ في المخزن
              </button>
              <button
                type="button"
                onClick={() => setShowAddDrugModal(false)}
                className="px-4 py-2.5 rounded-xl border text-sm font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* نافذة 4: تعديل رصيد وسعر دواء في المخزن */}
      {editingDrug && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleUpdateStock}
            className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl"
          >
            <h3 className="text-base font-extrabold text-slate-900">
              تحديث المخزن: {editingDrug.commercial_name_en}
            </h3>
            <div>
              <label className="block text-xs font-bold mb-1">الكمية المتاحة (علبة)</label>
              <input
                type="number"
                value={editingDrug.stock_quantity}
                onChange={(e) => setEditingDrug({ ...editingDrug, stock_quantity: e.target.value })}
                className="w-full bg-slate-50 border rounded-xl px-3.5 py-2 text-sm font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">السعر (ج.م)</label>
              <input
                type="number"
                step="0.01"
                value={editingDrug.price_egp}
                onChange={(e) => setEditingDrug({ ...editingDrug, price_egp: e.target.value })}
                className="w-full bg-slate-50 border rounded-xl px-3.5 py-2 text-sm font-bold"
                required
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-sky-600 text-white py-2.5 rounded-xl text-sm font-extrabold cursor-pointer"
              >
                تحديث
              </button>
              <button
                type="button"
                onClick={() => setEditingDrug(null)}
                className="px-4 py-2.5 rounded-xl border text-sm font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* نافذة 5: معاينة وطباعة الفاتورة الإلكترونية */}
      {printedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="text-center border-b pb-4">
              <img
                src="/logo.jpg"
                alt="Logo"
                className="w-16 h-16 mx-auto rounded-xl bg-[#0B1E38] object-cover mb-2"
              />
              <h3 className="text-lg font-extrabold text-slate-900">PharmaHistory — صيدليتك</h3>
              <p className="text-xs text-slate-500">فاتورة صرف أدوية إلكترونية</p>
              <p className="text-xs font-extrabold text-sky-700 mt-1">{printedInvoice.invoice_number}</p>
            </div>

            <div className="text-xs space-y-1 bg-slate-50 p-3 rounded-xl">
              <p><b>المريض:</b> {printedInvoice.patient?.name}</p>
              <p><b>الرقم القومي:</b> {printedInvoice.patient?.national_id}</p>
              <p><b>الصيدلي المسؤول:</b> د. {printedInvoice.pharmacist_name}</p>
              <p><b>التاريخ:</b> {printedInvoice.created_at}</p>
            </div>

            <table className="w-full text-right text-xs border-t border-b">
              <thead>
                <tr className="text-slate-500 border-b">
                  <th className="py-2">الدواء</th>
                  <th className="py-2">الكمية</th>
                  <th className="py-2">السعر</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {printedInvoice.items?.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2 font-bold">{item.drug?.commercial_name_en}</td>
                    <td className="py-2">{item.quantity}</td>
                    <td className="py-2 font-bold">{formatPrice(item.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span>المجموع الفرعي:</span>
                <span>{formatPrice(printedInvoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-rose-600">
                <span>الخصم:</span>
                <span>- {formatPrice(printedInvoice.discount)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-emerald-700 pt-1 border-t">
                <span>الإجمالي المدفوع:</span>
                <span>{formatPrice(printedInvoice.total)}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 bg-sky-600 hover:bg-sky-700 text-white py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer size={16} /> طباعة الفاتورة
              </button>
              <button
                onClick={() => setPrintedInvoice(null)}
                className="px-5 py-2.5 rounded-xl border text-xs font-extrabold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}