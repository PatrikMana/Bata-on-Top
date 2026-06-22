<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('runs', function (Blueprint $table) {
            $table->id();
            $table->string('player_name', 64);
            $table->string('map_name', 128);
            $table->unsignedInteger('time_ms')->nullable();
            $table->string('status', 16)->default('active')->index();
            $table->string('run_token_hash', 64)->nullable();
            $table->timestamp('started_at')->useCurrent();
            $table->timestamp('last_seen_at')->nullable()->index();
            $table->timestamp('finished_at')->nullable()->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('runs');
    }
};
