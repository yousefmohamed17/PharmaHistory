<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Hash;
use Illuminate\Http\Request;
use App\Models\User;
use App\Http\Controllers\PatientController;
use App\Http\Controllers\DrugController;

// تسجيل دخول مبسط: يوزر وباسورد فقط
Route::post('/login', function (Request $request) {
    $request->validate([
        'username' => 'required|string',
        'password' => 'required|string',
    ]);

    $username = trim($request->username);
    $user = User::where('name', $username)
                ->orWhere('email', $username)
                ->first();

    if (!$user || !Hash::check($request->password, $user->password)) {
        return response()->json([
            'message' => 'اسم المستخدم أو كلمة المرور غير صحيحة'
        ], 401);
    }

    return response()->json([
        'message' => 'تم تسجيل الدخول بنجاح',
        'user'    => $user
    ]);
});

// إدارة المخزن والأدوية
Route::get('/drugs', [DrugController::class, 'index']);
Route::get('/drug-classes', [DrugController::class, 'classes']);
Route::post('/drugs', [DrugController::class, 'store']);
Route::patch('/drugs/{id}', [DrugController::class, 'update']);

// إدارة المرضى
Route::get('/patients', [PatientController::class, 'index']);
Route::get('/patients/{national_id}', [PatientController::class, 'showByNationalId']);
Route::post('/patients', [PatientController::class, 'store']);
Route::post('/patients/{id}/allergies', [PatientController::class, 'addAllergy']);
Route::patch('/medications/{id}/side-effect', [PatientController::class, 'reportSideEffect']);

// الفواتير والصرف
Route::post('/invoices', [PatientController::class, 'createInvoice']);
Route::get('/invoices', [PatientController::class, 'getInvoices']);