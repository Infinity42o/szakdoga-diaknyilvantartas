DROP DATABASE IF EXISTS teszt_kurzus_halado;
CREATE DATABASE teszt_kurzus_halado CHARACTER SET utf8mb4 COLLATE utf8mb4_hungarian_ci;
USE teszt_kurzus_halado;

CREATE TABLE hallgato (
    id INT NOT NULL AUTO_INCREMENT,
    nev VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL,
    szak VARCHAR(100) NOT NULL,
    aktiv TINYINT(1) NOT NULL DEFAULT 1,
    felvetel_eve INT NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE oktato (
    id INT NOT NULL AUTO_INCREMENT,
    nev VARCHAR(100) NOT NULL,
    tanszek VARCHAR(100) NOT NULL,
    beosztas ENUM('tanarseged','adjunktus','docens','professzor') NOT NULL DEFAULT 'adjunktus',
    PRIMARY KEY (id)
);

CREATE TABLE kurzus (
    id INT NOT NULL AUTO_INCREMENT,
    oktato_id INT NOT NULL,
    kod VARCHAR(20) NOT NULL,
    nev VARCHAR(120) NOT NULL,
    felev VARCHAR(20) NOT NULL,
    kredit INT NOT NULL DEFAULT 5,
    tipus ENUM('eloadas','gyakorlat','labor') NOT NULL DEFAULT 'eloadas',
    max_letszam INT NOT NULL DEFAULT 30,
    PRIMARY KEY (id)
);

CREATE TABLE jelentkezes (
    hallgato_id INT NOT NULL,
    kurzus_id INT NOT NULL,
    jelentkezes_datuma DATE NOT NULL,
    allapot ENUM('aktiv','teljesitett','lemondott') NOT NULL DEFAULT 'aktiv',
    jegy INT DEFAULT NULL,
    PRIMARY KEY (hallgato_id, kurzus_id)
);

ALTER TABLE hallgato
    ADD CONSTRAINT uq_hallgato_email UNIQUE (email);

ALTER TABLE kurzus
    ADD CONSTRAINT uq_kurzus_kod UNIQUE (kod),
    ADD KEY idx_kurzus_oktato (oktato_id),
    ADD CONSTRAINT fk_kurzus_oktato
        FOREIGN KEY (oktato_id) REFERENCES oktato(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT;

ALTER TABLE jelentkezes
    ADD KEY idx_jelentkezes_kurzus (kurzus_id),
    ADD CONSTRAINT fk_jelentkezes_hallgato
        FOREIGN KEY (hallgato_id) REFERENCES hallgato(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    ADD CONSTRAINT fk_jelentkezes_kurzus
        FOREIGN KEY (kurzus_id) REFERENCES kurzus(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE;

INSERT INTO hallgato (nev, email, szak, aktiv, felvetel_eve) VALUES
('Kiss Anna', 'kiss.anna@example.com', 'Programtervező informatikus', 1, 2023),
('Nagy Bence', 'nagy.bence@example.com', 'Gazdaságinformatikus', 1, 2022),
('Tóth Réka', 'toth.reka@example.com', 'Programtervező informatikus', 1, 2024),
('Fekete Márk', 'fekete.mark@example.com', 'Mérnökinformatikus', 0, 2021);

INSERT INTO oktato (nev, tanszek, beosztas) VALUES
('Dr. Kovács Péter', 'Szoftverfejlesztési Tanszék', 'docens'),
('Dr. Szabó Júlia', 'Mesterséges Intelligencia Tanszék', 'adjunktus');

INSERT INTO kurzus (oktato_id, kod, nev, felev, kredit, tipus, max_letszam) VALUES
(1, 'DB001', 'Adatbázisok', '2025/26/1', 5, 'eloadas', 60),
(1, 'WEB101', 'Webfejlesztés', '2025/26/1', 4, 'gyakorlat', 25),
(2, 'AI210', 'Gépi tanulás alapjai', '2025/26/2', 5, 'eloadas', 40);

INSERT INTO jelentkezes (hallgato_id, kurzus_id, jelentkezes_datuma, allapot, jegy) VALUES
(1, 1, '2025-09-05', 'teljesitett', 5),
(1, 2, '2025-09-05', 'aktiv', NULL),
(2, 1, '2025-09-06', 'teljesitett', 4),
(3, 3, '2026-02-01', 'aktiv', NULL),
(4, 2, '2025-09-07', 'lemondott', NULL);