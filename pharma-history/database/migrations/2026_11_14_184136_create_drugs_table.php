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
    Schema::create('drugs', function (Blueprint $table) {
        $table->id();
        $table->text('commercial_name_en');
        $table->text('commercial_name_ar')->nullable();
        $table->text('scientific_name')->nullable(); // المادة الفعالة
        $table->text('manufacturer')->nullable();
        $table->text('drug_class')->nullable(); // التصنيف العلاجي
        $table->text('route')->nullable(); // طريقة التعاطي
        $table->decimal('price_egp', 10, 2)->nullable();
        $table->timestamps();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('drugs');
    }
};
