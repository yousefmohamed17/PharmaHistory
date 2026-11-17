<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PatientMedication extends Model
{
    protected $fillable = [
        'patient_id', 'drug_id', 'dosage',
        'dispensed_date', 'had_side_effects', 'side_effect_notes'
    ];

    public function drug()
    {
        return $this->belongsTo(Drug::class);
    }

    public function patient()
    {
        return $this->belongsTo(Patient::class);
    }
}