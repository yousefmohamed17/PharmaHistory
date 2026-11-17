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
    Schema::create('patients', function (Blueprint $table) {
        $table->id();
        $table->string('national_id', 14)->unique(); // الرقم القومي
        $table->string('name');
        $table->integer('age')->nullable();
        $table->string('phone')->nullable();
        $table->text('known_allergies')->nullable(); // أي حساسية معروفة مسبقاً
        $table->timestamps();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('patients');
    }
};
