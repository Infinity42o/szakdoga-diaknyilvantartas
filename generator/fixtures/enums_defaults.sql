-- enums_defaults.sql
CREATE TABLE `E` (
  `id` INT NOT NULL,
  `nem` ENUM('no','ferfi','egyeb'),
  `flag` TINYINT(1) DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `note` VARCHAR(50) COMMENT 'megjegyzes',
  PRIMARY KEY (`id`)
);
