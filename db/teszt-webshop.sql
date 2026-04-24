DROP DATABASE IF EXISTS teszt_webshop;
CREATE DATABASE teszt_webshop CHARACTER SET utf8mb4 COLLATE utf8mb4_hungarian_ci;
USE teszt_webshop;

CREATE TABLE kategoria (
    id INT NOT NULL AUTO_INCREMENT,
    nev VARCHAR(100) NOT NULL,
    leiras VARCHAR(255) DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_kategoria_nev (nev)
);

CREATE TABLE termek (
    id INT NOT NULL AUTO_INCREMENT,
    kategoria_id INT NOT NULL,
    nev VARCHAR(120) NOT NULL,
    ar DECIMAL(10,2) NOT NULL,
    keszlet INT NOT NULL DEFAULT 0,
    aktiv TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    KEY idx_termek_kategoria (kategoria_id),
    CONSTRAINT fk_termek_kategoria
        FOREIGN KEY (kategoria_id) REFERENCES kategoria(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE rendeles (
    id INT NOT NULL AUTO_INCREMENT,
    vevo_nev VARCHAR(100) NOT NULL,
    datum DATE NOT NULL,
    allapot ENUM('uj','feldolgozas_alatt','lezart') NOT NULL DEFAULT 'uj',
    PRIMARY KEY (id)
);

CREATE TABLE rendeles_tetel (
    id INT NOT NULL AUTO_INCREMENT,
    rendeles_id INT NOT NULL,
    termek_id INT NOT NULL,
    mennyiseg INT NOT NULL,
    egysegar DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_rt_rendeles (rendeles_id),
    KEY idx_rt_termek (termek_id),
    CONSTRAINT fk_rt_rendeles
        FOREIGN KEY (rendeles_id) REFERENCES rendeles(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_rt_termek
        FOREIGN KEY (termek_id) REFERENCES termek(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

INSERT INTO kategoria (nev, leiras) VALUES
('Laptop', 'Hordozható számítógépek'),
('Monitor', 'Kijelzők és monitorok'),
('Periféria', 'Egerek, billentyűzetek, headsetek');

INSERT INTO termek (kategoria_id, nev, ar, keszlet, aktiv) VALUES
(1, 'Lenovo IdeaPad 5', 289990.00, 7, 1),
(1, 'ASUS Vivobook 15', 259990.00, 4, 1),
(2, 'Dell 27 QHD', 119990.00, 12, 1),
(2, 'LG UltraWide 34', 179990.00, 3, 1),
(3, 'Logitech MX Master 3S', 42990.00, 15, 1),
(3, 'HyperX Alloy Origins', 35990.00, 9, 1);

INSERT INTO rendeles (vevo_nev, datum, allapot) VALUES
('Kovács Márk', '2025-04-02', 'lezart'),
('Varga Eszter', '2025-04-03', 'feldolgozas_alatt'),
('Szabó Lili', '2025-04-05', 'uj');

INSERT INTO rendeles_tetel (rendeles_id, termek_id, mennyiseg, egysegar) VALUES
(1, 1, 1, 289990.00),
(1, 5, 1, 42990.00),
(2, 3, 2, 119990.00),
(3, 6, 1, 35990.00),
(3, 5, 2, 42990.00);