<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DrugSeeder extends Seeder
{
    public function run(): void
    {
        $filePath = database_path('data/egyptian-drugs.csv');

        if (!file_exists($filePath)) {
            $this->command->error("الملف غير موجود في: database/data/egyptian-drugs.csv");
            return;
        }

        $file = fopen($filePath, 'r');
        $header = fgetcsv($file);

        // تنظيف أسماء الأعمدة من أي رموز مخفية
        $header = array_map(function ($col) {
            return trim(preg_replace('/[\x00-\x1F\x80-\xFF]/', '', $col));
        }, $header);

        $batch = [];
        $now = now();

        while (($row = fgetcsv($file)) !== false) {
            if (count($row) !== count($header)) {
                continue;
            }

            $data = array_combine($header, $row);
            $price = isset($data['price_egp']) ? trim($data['price_egp']) : '';

            $batch[] = [
                'commercial_name_en' => trim($data['commercial_name_en'] ?? ''),
                'commercial_name_ar' => trim($data['commercial_name_ar'] ?? '') ?: null,
                'scientific_name'    => trim($data['scientific_name'] ?? '') ?: null,
                'manufacturer'       => trim($data['manufacturer'] ?? '') ?: null,
                'drug_class'         => trim($data['drug_class'] ?? '') ?: null,
                'route'              => trim($data['route'] ?? '') ?: null,
                'price_egp'          => is_numeric($price) ? (float) $price : null,
                'created_at'         => $now,
                'updated_at'         => $now,
            ];

            if (count($batch) >= 500) {
                DB::table('drugs')->insert($batch);
                $batch = [];
            }
        }

        if (!empty($batch)) {
            DB::table('drugs')->insert($batch);
        }

        fclose($file);
        $this->command->info("تم رفع جميع الأدوية بنجاح!");
    }
}