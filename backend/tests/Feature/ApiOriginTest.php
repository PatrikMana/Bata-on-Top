<?php

namespace Tests\Feature;

use Tests\TestCase;

class ApiOriginTest extends TestCase
{
    public function test_production_api_accepts_the_configured_frontend_origin(): void
    {
        config([
            'api.frontend_origin' => 'https://ontop.bata.eu',
            'api.require_origin' => true,
            'cors.allowed_origins' => ['https://ontop.bata.eu'],
        ]);

        $this->withHeader('Origin', 'https://ontop.bata.eu')
            ->options('/api/runs/start')
            ->assertNoContent()
            ->assertHeader('Access-Control-Allow-Origin', 'https://ontop.bata.eu');
    }

    public function test_production_api_rejects_an_unconfigured_origin(): void
    {
        config([
            'api.frontend_origin' => 'https://ontop.bata.eu',
            'api.require_origin' => true,
            'cors.allowed_origins' => ['https://ontop.bata.eu'],
        ]);

        $this->withHeader('Origin', 'https://example.com')
            ->getJson('/api/leaderboard')
            ->assertForbidden()
            ->assertHeader('Access-Control-Allow-Origin', 'https://ontop.bata.eu');
    }

    public function test_production_api_rejects_a_missing_origin(): void
    {
        config([
            'api.frontend_origin' => 'https://ontop.bata.eu',
            'api.require_origin' => true,
            'cors.allowed_origins' => ['https://ontop.bata.eu'],
        ]);

        $this->options('/api/runs/start')
            ->assertForbidden();
    }
}
