<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Patient;
use App\Models\Drug;
use App\Models\PatientMedication;

class PatientSeeder extends Seeder
{
    public function run(): void
    {
        PatientMedication::query()->delete();
        Patient::query()->delete();

        // 1. مريض عنده حساسية بنسلين وأثر جانبي سابق من أدوية البرد (Pseudoephedrine)
        $p1 = Patient::create([
            'national_id'     => '29901011234567',
            'name'            => 'محمد طارق السيد',
            'age'             => 27,
            'phone'           => '01012345678',
            'known_allergies' => 'PENICILLIN, AMOXICILLIN',
        ]);
        $coldDrug = Drug::where('scientific_name', 'like', '%PSEUDOEPHEDRINE%')->first();
        if ($coldDrug) {
            PatientMedication::create([
                'patient_id'        => $p1->id,
                'drug_id'           => $coldDrug->id,
                'dosage'            => 'قرص 3 مرات يومياً',
                'dispensed_date'    => now()->subDays(12)->toDateString(),
                'had_side_effects'  => true,
                'side_effect_notes' => 'سبب خفقان شديد وارتفاع في ضغط الدم بسبب مادة Pseudoephedrine',
            ]);
        }

        // 2. مريضة بتاخد أسبرين للسيولة -> يتعارض منطقياً مع المسكنات (Ibuprofen / Diclofenac)
        $p2 = Patient::create([
            'national_id'     => '29505057654321',
            'name'            => 'سارة محمود حسن',
            'age'             => 34,
            'phone'           => '01198765432',
            'known_allergies' => '',
        ]);
        $aspirinDrug = Drug::where('scientific_name', 'like', '%ASPIRIN%')->first();
        if ($aspirinDrug) {
            PatientMedication::create([
                'patient_id'        => $p2->id,
                'drug_id'           => $aspirinDrug->id,
                'dosage'            => 'قرص يومياً بعد الغداء',
                'dispensed_date'    => now()->subDays(5)->toDateString(),
                'had_side_effects'  => false,
            ]);
        }

        // 3. مريض بياخد باراسيتامول -> لو صرفتله دواء برد فيه باراسيتامول يحذرك من تكرار الجرعة
        $p3 = Patient::create([
            'national_id'     => '29208151122334',
            'name'            => 'كريم عادل مصطفى',
            'age'             => 31,
            'phone'           => '01234567890',
            'known_allergies' => 'DICLOFENAC',
        ]);
        $paraDrug = Drug::where('scientific_name', 'PARACETAMOL')->first();
        if ($paraDrug) {
            PatientMedication::create([
                'patient_id'        => $p3->id,
                'drug_id'           => $paraDrug->id,
                'dosage'            => 'قرص كل 8 ساعات',
                'dispensed_date'    => now()->subDays(1)->toDateString(),
                'had_side_effects'  => false,
            ]);
        }

        // 4. مريضة سجلها سليم لتجربة إصدار فاتورة كاملة بدون تعارضات
        Patient::create([
            'national_id'     => '30103209876543',
            'name'            => 'نورهان أحمد علي',
            'age'             => 25,
            'phone'           => '01555443322',
            'known_allergies' => '',
        ]);

        $this->command->info('تم إضافة الـ 4 مرضى التجريبيين بسيناريوهات التعارض المنطقية بنجاح!');
    }
}