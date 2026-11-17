<?php

namespace App\Http\Controllers;

use App\Models\Drug;
use Illuminate\Http\Request;

class DrugController extends Controller
{
    // جلب كل الأدوية بنظام الصفحات مع البحث والفلترة
    public function index(Request $request)
    {
        $search = $request->query('search');
        $drugClass = $request->query('drug_class');
        $lowStock = $request->query('low_stock');
        $perPage = $request->query('per_page', 30);

        $query = Drug::query();

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('commercial_name_en', 'like', "%{$search}%")
                  ->orWhere('commercial_name_ar', 'like', "%{$search}%")
                  ->orWhere('scientific_name', 'like', "%{$search}%")
                  ->orWhere('drug_class', 'like', "%{$search}%");
            });
        }

        if ($drugClass) {
            $query->where('drug_class', $drugClass);
        }

        if ($lowStock === '1') {
            $query->where('stock_quantity', '<=', 10);
        }

        return response()->json($query->orderBy('id', 'asc')->paginate($perPage));
    }

    // جلب التصنيفات العلاجية للفلتر
    public function classes()
    {
        $classes = Drug::whereNotNull('drug_class')
            ->where('drug_class', '!=', '')
            ->distinct()
            ->limit(80)
            ->pluck('drug_class');

        return response()->json($classes);
    }

    // إضافة دواء جديد للمخزن
    public function store(Request $request)
    {
        $validated = $request->validate([
            'commercial_name_en' => 'required|string',
            'commercial_name_ar' => 'nullable|string',
            'scientific_name'    => 'nullable|string',
            'manufacturer'       => 'nullable|string',
            'drug_class'         => 'nullable|string',
            'route'              => 'nullable|string',
            'price_egp'          => 'required|numeric|min:0',
            'stock_quantity'     => 'required|integer|min:0',
        ]);

        $drug = Drug::create($validated);

        return response()->json([
            'message' => 'تم إضافة الدواء للمخزن بنجاح',
            'drug'    => $drug
        ], 201);
    }

    // تعديل رصيد المخزن أو السعر لدواء موجود
    public function update(Request $request, $id)
    {
        $drug = Drug::findOrFail($id);
        $drug->update($request->only(['stock_quantity', 'price_egp']));

        return response()->json([
            'message' => 'تم تحديث بيانات الدواء في المخزن',
            'drug'    => $drug
        ]);
    }
}