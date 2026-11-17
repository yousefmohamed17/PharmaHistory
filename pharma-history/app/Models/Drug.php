<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Drug extends Model
{
    protected $fillable = [
        'commercial_name_en', 'commercial_name_ar', 'scientific_name',
        'manufacturer', 'drug_class', 'route', 'price_egp', 'stock_quantity'
    ];
}