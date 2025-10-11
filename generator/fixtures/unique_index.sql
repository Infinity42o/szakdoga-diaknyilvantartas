-- unique_index.sql
CREATE TABLE `U` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(120) NOT NULL,
  UNIQUE KEY `uq_email` (`email`),
  KEY `ix_email_prefix` (`email`),
  PRIMARY KEY (`id`)
);
