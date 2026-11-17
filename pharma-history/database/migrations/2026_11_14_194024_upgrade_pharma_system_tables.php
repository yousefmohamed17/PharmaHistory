<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // إضافة رصيد المخزن لجدول الأدوية
        Schema::table('drugs', function (Blueprint $table) {
            if (!Schema::hasColumn('drugs', 'stock_quantity')) {
                $table->integer('stock_quantity')->default(40)->after('price_egp');
            }
        });

        // جدول الفواتير
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->string('invoice_number')->unique();
            $table->foreignId('patient_id')->nullable()->constrained()->onDelete('set null');
            $table->string('pharmacist_name')->default('يوسف محمد');
            $table->decimal('subtotal', 10, 2);
            $table->decimal('discount', 10, 2)->default(0);
            $table->decimal('total', 10, 2);
            $table->timestamps();
        });

        // جدول تفاصيل أصناف الفاتورة
        Schema::create('invoice_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained()->onDelete('cascade');
            $table->foreignId('drug_id')->constrained()->onDelete('cascade');
            $table->integer('quantity')->default(1);
            $table->decimal('unit_price', 10, 2);
            $table->decimal('total_price', 10, 2);
            $table->string('dosage')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoice_items');
        Schema::dropIfExists('invoices');
        Schema::table('drugs', function (Blueprint $table) {
            $table->dropColumn('stock_quantity');
        });
    }
};