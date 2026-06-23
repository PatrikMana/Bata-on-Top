<?php

namespace Tests\Feature;

use App\Models\Run;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RunApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        if (! extension_loaded('pdo_sqlite')) {
            $this->markTestSkipped('The pdo_sqlite extension is required for run API database tests.');
        }

        parent::setUp();
    }

    public function test_run_can_start_finish_and_appear_on_leaderboard(): void
    {
        $startResponse = $this->postJson('/api/runs/start', [
            'playerName' => 'Patrik',
            'mapName' => 'Bata Tower',
        ]);

        $startResponse
            ->assertCreated()
            ->assertJsonStructure(['runId', 'runToken', 'startedAt']);

        $runId = $startResponse->json('runId');
        $runToken = $startResponse->json('runToken');

        $this->travel(12)->seconds();

        $finishResponse = $this->postJson('/api/runs/finish', [
            'runId' => $runId,
            'runToken' => $runToken,
        ]);

        $finishResponse
            ->assertOk()
            ->assertJsonPath('status', 'FINISHED')
            ->assertJsonPath('runId', $runId);

        $this->assertGreaterThanOrEqual(12_000, $finishResponse->json('timeMs'));

        $this->getJson('/api/leaderboard?mapName=Bata%20Tower')
            ->assertOk()
            ->assertJsonPath('0.id', $runId)
            ->assertJsonPath('0.playerName', 'Patrik')
            ->assertJsonPath('0.mapName', 'Bata Tower');
    }

    public function test_abort_deletes_active_run(): void
    {
        $startResponse = $this->postJson('/api/runs/start', [
            'playerName' => 'Patrik',
            'mapName' => 'Bata Tower',
        ]);

        $this->postJson('/api/runs/abort', [
            'runId' => $startResponse->json('runId'),
            'runToken' => $startResponse->json('runToken'),
        ])->assertOk()->assertJsonPath('status', 'ABORTED');

        $this->assertDatabaseCount('runs', 0);
    }

    public function test_expired_active_run_is_deleted(): void
    {
        $startResponse = $this->postJson('/api/runs/start', [
            'playerName' => 'Patrik',
            'mapName' => 'Bata Tower',
        ]);

        $this->travel(16)->seconds();

        $this->postJson('/api/runs/heartbeat', [
            'runId' => $startResponse->json('runId'),
            'runToken' => $startResponse->json('runToken'),
        ])->assertUnprocessable();

        $this->assertDatabaseCount('runs', 0);
    }

    public function test_heartbeat_keeps_run_active(): void
    {
        $startResponse = $this->postJson('/api/runs/start', [
            'playerName' => 'Patrik',
            'mapName' => 'Bata Tower',
        ]);

        $this->travel(10)->seconds();

        $this->postJson('/api/runs/heartbeat', [
            'runId' => $startResponse->json('runId'),
            'runToken' => $startResponse->json('runToken'),
        ])->assertOk()->assertJsonPath('status', 'ACTIVE');

        $this->assertDatabaseHas('runs', [
            'id' => $startResponse->json('runId'),
            'status' => Run::STATUS_ACTIVE,
        ]);
    }

    public function test_better_time_replaces_previous_leaderboard_run_for_same_player_and_map(): void
    {
        $firstRun = $this->postJson('/api/runs/start', [
            'playerName' => 'Patrik',
            'mapName' => 'Bata Tower',
        ]);

        $this->travel(10)->seconds();

        $this->postJson('/api/runs/finish', [
            'runId' => $firstRun->json('runId'),
            'runToken' => $firstRun->json('runToken'),
        ])->assertOk()->assertJsonPath('personalBest', true);

        $secondRun = $this->postJson('/api/runs/start', [
            'playerName' => 'Patrik',
            'mapName' => 'Bata Tower',
        ]);

        $this->travel(6)->seconds();

        $finishResponse = $this->postJson('/api/runs/finish', [
            'runId' => $secondRun->json('runId'),
            'runToken' => $secondRun->json('runToken'),
        ]);

        $finishResponse
            ->assertOk()
            ->assertJsonPath('personalBest', true)
            ->assertJsonPath('leaderboardRunId', $secondRun->json('runId'));

        $this->assertDatabaseCount('runs', 1);
        $this->assertDatabaseMissing('runs', [
            'id' => $firstRun->json('runId'),
        ]);
        $this->assertDatabaseHas('runs', [
            'id' => $secondRun->json('runId'),
            'player_name' => 'Patrik',
            'map_name' => 'Bata Tower',
            'status' => Run::STATUS_FINISHED,
        ]);
    }

    public function test_slower_time_is_not_saved_for_same_player_and_map(): void
    {
        $firstRun = $this->postJson('/api/runs/start', [
            'playerName' => 'Patrik',
            'mapName' => 'Bata Tower',
        ]);

        $this->travel(6)->seconds();

        $this->postJson('/api/runs/finish', [
            'runId' => $firstRun->json('runId'),
            'runToken' => $firstRun->json('runToken'),
        ])->assertOk()->assertJsonPath('personalBest', true);

        $secondRun = $this->postJson('/api/runs/start', [
            'playerName' => 'Patrik',
            'mapName' => 'Bata Tower',
        ]);

        $this->travel(10)->seconds();

        $finishResponse = $this->postJson('/api/runs/finish', [
            'runId' => $secondRun->json('runId'),
            'runToken' => $secondRun->json('runToken'),
        ]);

        $finishResponse
            ->assertOk()
            ->assertJsonPath('personalBest', false)
            ->assertJsonPath('leaderboardRunId', $firstRun->json('runId'));

        $this->assertDatabaseCount('runs', 1);
        $this->assertDatabaseHas('runs', [
            'id' => $firstRun->json('runId'),
            'player_name' => 'Patrik',
            'map_name' => 'Bata Tower',
            'status' => Run::STATUS_FINISHED,
        ]);
        $this->assertDatabaseMissing('runs', [
            'id' => $secondRun->json('runId'),
        ]);
    }
}
