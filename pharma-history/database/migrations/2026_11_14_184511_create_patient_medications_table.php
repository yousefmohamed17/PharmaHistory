<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
public function up(): void
{
    Schema::create('patient_medications', function (Blueprint $table) {
        $table->id();
        $table->foreignId('patient_id')->constrained()->onDelete('cascade');
        $table->foreignId('drug_id')->constrained()->onDelete('cascade');
        $table->string('dosage')->nullable(); // الجرعة
        $table->date('dispensed_date'); // تاريخ الصرف
        $table->boolean('had_side_effects')->default(false); // هل سبب مشكلة للمريض؟
        $table->text('side_effect_notes')->nullable(); // تفاصيل المشكلة أو الحساسية
        $table->timestamps();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('patient_medications');
    }
};
