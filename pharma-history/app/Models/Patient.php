<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Patient extends Model
{
    protected $fillable = ['national_id', 'name', 'age', 'phone', 'known_allergies'];

    public function medications()
    {
        return $this->hasMany(PatientMedication::class)
                    ->with('drug')
                    ->orderBy('dispensed_date', 'desc');
    }
}