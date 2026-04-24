DROP DATABASE IF EXISTS teszt_ugyfel_crud3;
CREATE DATABASE teszt_ugyfel_crud3 CHARACTER SET utf8mb4 COLLATE utf8mb4_hungarian_ci;
USE teszt_ugyfel_crud3;

CREATE TABLE ugyfel (
    id INT NOT NULL AUTO_INCREMENT,
    nev VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL,
    telefon VARCHAR(30) DEFAULT NULL,
    varos VARCHAR(80) NOT NULL,
    eletkor INT DEFAULT NULL,
    regisztracio_datuma DATE NOT NULL,
    aktiv TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_ugyfel_email (email),
    KEY idx_ugyfel_varos (varos)
);

INSERT INTO ugyfel (nev, email, telefon, varos, eletkor, regisztracio_datuma, aktiv) VALUES
('Kiss Anna', 'anna@example.com', '06201111111', 'Szeged', 21, '2025-01-15', 1),
('Nagy Péter', 'peter@example.com', '06302222222', 'Budapest', 27, '2025-02-10', 1),
('Tóth Réka', 'reka@example.com', NULL, 'Szeged', 19, '2025-03-02', 0),
('Farkas Dániel', 'daniel@example.com', '06703333333', 'Debrecen', 31, '2025-03-18', 1);