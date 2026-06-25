CREATE TABLE IF NOT EXISTS `migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) NOT NULL,
  `batch` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `runs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `player_name` varchar(64) NOT NULL,
  `map_name` varchar(128) NOT NULL,
  `time_ms` int unsigned DEFAULT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'active',
  `run_token_hash` varchar(64) DEFAULT NULL,
  `started_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_seen_at` timestamp NULL DEFAULT NULL,
  `finished_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `runs_status_index` (`status`),
  KEY `runs_last_seen_at_index` (`last_seen_at`),
  KEY `runs_finished_at_index` (`finished_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_06_22_000000_create_runs_table', 1
WHERE NOT EXISTS (
  SELECT 1
  FROM `migrations`
  WHERE `migration` = '2026_06_22_000000_create_runs_table'
);
