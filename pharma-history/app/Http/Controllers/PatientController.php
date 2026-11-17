<?php

namespace App\Http\Controllers;

use App\Models\Patient;
use App\Models\Drug;
use App\Models\PatientMedication;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PatientController extends Controller
{
    // عرض كل المرضى مع إمكانية البحث بالاسم أو البطاقة أو الهاتف
    public function index(Request $request)
    {
        $search = $request->query('search');
        $query = Patient::with('medications')->orderBy('created_at', 'desc');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('national_id', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        return response()->json($query->get());
    }

    // البحث عن مريض محدد بالرقم القومي
    public function showByNationalId($national_id)
    {
        $patient = Patient::with('medications')->where('national_id', $national_id)->first();

        if (!$patient) {
            return response()->json([
                'found' => false,
                'message' => 'لا توجد نتائج بحث لهذا الرقم القومي'
            ], 404);
        }

        return response()->json([
            'found' => true,
            'patient' => $patient
        ]);
    }

    // إضافة مريض جديد
    public function store(Request $request)
    {
        $validated = $request->validate([
            'national_id'     => 'required|string|size:14|unique:patients,national_id',
            'name'            => 'required|string|max:255',
            'age'             => 'nullable|integer',
            'phone'           => 'nullable|string|max:20',
            'known_allergies' => 'nullable|string',
        ]);

        $patient = Patient::create($validated);

        return response()->json([
            'message' => 'تم إضافة المريض بنجاح',
            'patient' => $patient->load('medications')
        ], 201);
    }

    // إصدار فاتورة وصرف الأدوية وخصمها من المخزن وتسجيلها في تاريخ المريض
    public function createInvoice(Request $request)
    {
        $validated = $request->validate([
            'patient_id'      => 'required|exists:patients,id',
            'pharmacist_name' => 'nullable|string',
            'discount'        => 'nullable|numeric|min:0',
            'items'           => 'required|array|min:1',
            'items.*.drug_id' => 'required|exists:drugs,id',
            'items.*.quantity'=> 'required|integer|min:1',
            'items.*.dosage'  => 'nullable|string',
        ]);

        return DB::transaction(function () use ($validated) {
            $subtotal = 0;
            $preparedItems = [];

            foreach ($validated['items'] as $item) {
                $drug = Drug::findOrFail($item['drug_id']);
                $unitPrice = (float) ($drug->price_egp ?? 0);
                $lineTotal = $unitPrice * $item['quantity'];
                $subtotal += $lineTotal;

                // خصم الكمية من المخزن
                $newStock = max(0, $drug->stock_quantity - $item['quantity']);
                $drug->update(['stock_quantity' => $newStock]);

                // تسجيل الدواء في التاريخ الدوائي للمريض
                PatientMedication::create([
                    'patient_id'     => $validated['patient_id'],
                    'drug_id'        => $drug->id,
                    'dosage'         => $item['dosage'] ?? 'حسب إرشادات الصيدلي',
                    'dispensed_date' => now()->toDateString(),
                ]);

                $preparedItems[] = [
                    'drug'        => $drug,
                    'quantity'    => $item['quantity'],
                    'unit_price'  => $unitPrice,
                    'total_price' => $lineTotal,
                    'dosage'      => $item['dosage'] ?? '',
                ];
            }

            $discount = (float) ($validated['discount'] ?? 0);
            $total = max(0, $subtotal - $discount);
            $invoiceNumber = 'INV-' . date('Ymd') . '-' . rand(1000, 9999);

            $invoiceId = DB::table('invoices')->insertGetId([
                'invoice_number'  => $invoiceNumber,
                'patient_id'      => $validated['patient_id'],
                'pharmacist_name' => $validated['pharmacist_name'] ?? 'يوسف محمد',
                'subtotal'        => $subtotal,
                'discount'        => $discount,
                'total'           => $total,
                'created_at'      => now(),
                'updated_at'      => now(),
            ]);

            foreach ($preparedItems as $pItem) {
                DB::table('invoice_items')->insert([
                    'invoice_id'  => $invoiceId,
                    'drug_id'     => $pItem['drug']->id,
                    'quantity'    => $pItem['quantity'],
                    'unit_price'  => $pItem['unit_price'],
                    'total_price' => $pItem['total_price'],
                    'dosage'      => $pItem['dosage'],
                    'created_at'  => now(),
                    'updated_at'  => now(),
                ]);
            }

            $patient = Patient::with('medications')->find($validated['patient_id']);

            return response()->json([
                'message' => 'تم إصدار الفاتورة وصرف الأدوية بنجاح',
                'invoice' => [
                    'id'              => $invoiceId,
                    'invoice_number'  => $invoiceNumber,
                    'patient'         => $patient,
                    'pharmacist_name' => $validated['pharmacist_name'] ?? 'يوسف محمد',
                    'subtotal'        => $subtotal,
                    'discount'        => $discount,
                    'total'           => $total,
                    'created_at'      => now()->format('Y-m-d H:i'),
                    'items'           => $preparedItems,
                ],
                'patient' => $patient,
            ], 201);
        });
    }

    // جلب سجل الفواتير الصادرة
    public function getInvoices()
    {
        $invoices = DB::table('invoices')
            ->leftJoin('patients', 'invoices.patient_id', '=', 'patients.id')
            ->select('invoices.*', 'patients.name as patient_name', 'patients.national_id as patient_national_id')
            ->orderBy('invoices.created_at', 'desc')
            ->get();

        foreach ($invoices as $inv) {
            $inv->items = DB::table('invoice_items')
                ->join('drugs', 'invoice_items.drug_id', '=', 'drugs.id')
                ->where('invoice_items.invoice_id', $inv->id)
                ->select('invoice_items.*', 'drugs.commercial_name_en', 'drugs.scientific_name')
                ->get();
        }

        return response()->json($invoices);
    }

    // تسجيل أثر جانبي لدواء سابق
    public function reportSideEffect(Request $request, $id)
    {
        $record = PatientMedication::findOrFail($id);
        $record->update([
            'had_side_effects'  => true,
            'side_effect_notes' => $request->input('side_effect_notes', 'سبب آثار جانبية أو حساسية للمريض'),
        ]);

        return response()->json([
            'message' => 'تم تحديث حالة الدواء وإضافة تحذير',
            'record'  => $record->load('drug')
        ]);
    }
    // تسجيل حساسية جديدة للمريض بناءً على المادة الفعالة للدواء المختار
    public function addAllergy(Request $request, $id)
    {
        $request->validate([
            'allergy' => 'required|string|max:255',
        ]);

        $patient = Patient::findOrFail($id);
        $newAllergy = strtoupper(trim($request->input('allergy')));

        $existing = array_filter(array_map('trim', explode(',', (string) $patient->known_allergies)));
        $existingUpper = array_map('strtoupper', $existing);

        if (!in_array($newAllergy, $existingUpper)) {
            $existing[] = $newAllergy;
            $patient->update([
                'known_allergies' => implode(', ', $existing)
            ]);
        }

        return response()->json([
            'message' => 'تم تسجيل الحساسية في ملف المريض بنجاح',
            'patient' => $patient->load('medications')
        ]);
    }
}
