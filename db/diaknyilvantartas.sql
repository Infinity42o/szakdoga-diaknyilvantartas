-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Gép: 127.0.0.1
-- Létrehozás ideje: 2025. Sze 29. 11:08
-- Kiszolgáló verziója: 10.4.32-MariaDB
-- PHP verzió: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Adatbázis: `diaknyilvantartas`
--

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `beiratkozas`
--

CREATE TABLE `beiratkozas` (
  `hallgato_id` int(10) UNSIGNED NOT NULL,
  `kurzus_id` int(10) UNSIGNED NOT NULL,
  `felvet_datum` datetime NOT NULL DEFAULT current_timestamp(),
  `jegy` tinyint(3) UNSIGNED DEFAULT NULL
) ;

--
-- A tábla adatainak kiíratása `beiratkozas`
--

INSERT INTO `beiratkozas` (`hallgato_id`, `kurzus_id`, `felvet_datum`, `jegy`) VALUES
(1, 1, '2024-09-10 10:00:00', 4),
(1, 11, '2025-02-13 10:00:00', NULL),
(2, 1, '2024-09-11 11:30:00', 3),
(2, 11, '2025-02-13 10:05:00', NULL),
(3, 1, '2024-09-12 09:15:00', 5),
(3, 11, '2025-02-13 10:10:00', NULL),
(4, 2, '2024-09-13 13:40:00', 5),
(4, 3, '2025-02-10 12:30:00', NULL),
(5, 3, '2025-02-10 12:10:00', NULL),
(5, 12, '2025-02-20 08:30:00', 3),
(6, 4, '2025-02-11 08:20:00', NULL),
(7, 5, '2024-09-14 14:00:00', 2),
(8, 7, '2024-09-15 15:30:00', 4),
(9, 9, '2024-09-16 16:45:00', 5),
(10, 10, '2025-02-12 09:00:00', NULL),
(13, 1, '2025-09-09 08:30:00', 5),
(13, 3, '2025-09-29 09:34:07', NULL);

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `hallgato`
--

CREATE TABLE `hallgato` (
  `id` int(10) UNSIGNED NOT NULL,
  `neptun` char(6) NOT NULL,
  `nev` varchar(120) NOT NULL,
  `nem` enum('no','ferfi','egyeb') DEFAULT NULL,
  `szak` varchar(80) NOT NULL,
  `evfolyam` tinyint(3) UNSIGNED NOT NULL,
  `szuldatum` date DEFAULT NULL,
  `email` varchar(120) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

--
-- A tábla adatainak kiíratása `hallgato`
--

INSERT INTO `hallgato` (`id`, `neptun`, `nev`, `nem`, `szak`, `evfolyam`, `szuldatum`, `email`) VALUES
(1, 'ABC123', 'Kiss Balázs', 'ferfi', 'Programtervező informatikus', 1, '2004-05-17', 'balazs.kiss@uni.hu'),
(2, 'DEF456', 'Tóth Eszter', 'no', 'Programtervező informatikus', 2, '2003-11-02', 'eszter.toth@uni.hu'),
(3, 'GHI789', 'Szabó Gábor', 'ferfi', 'Gazdaságinformatikus', 1, '2004-08-21', 'gabor.szabo@uni.hu'),
(4, 'JKL012', 'Varga Réka', 'no', 'Programtervező informatikus', 3, '2002-12-05', 'reka.varga@uni.hu'),
(5, 'MNO345', 'Horváth Ádám', 'ferfi', 'Gazdaságinformatikus', 2, '2003-04-09', 'adam.horvath@uni.hu'),
(6, 'PQR678', 'Nagy Dóra', 'no', 'Programtervező informatikus', 1, '2004-07-14', 'dora.nagy@uni.hu'),
(7, 'STU901', 'Farkas Máté', 'ferfi', 'Mérnökinformatikus', 2, '2003-03-30', 'mate.farkas@uni.hu'),
(8, 'VWX234', 'Kovács Lili', 'no', 'Mérnökinformatikus', 1, '2004-01-22', 'lili.kovacs@uni.hu'),
(9, 'YZA567', 'Molnár Zsolt', 'ferfi', 'Programtervező informatikus', 3, '2002-09-11', 'zsolt.molnar@uni.hu'),
(10, 'BCD890', 'Takács Hanna', 'no', 'Gazdaságinformatikus', 2, '2003-06-06', 'hanna.takacs@uni.hu'),
(13, 'XYZ999', 'Teszt Elek', 'ferfi', 'Programtervező informatikus', 1, '2004-10-10', 'teszt.elek@uni.hu');

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `kurzus`
--

CREATE TABLE `kurzus` (
  `id` int(10) UNSIGNED NOT NULL,
  `tantargy_id` int(10) UNSIGNED NOT NULL,
  `tanar_id` int(10) UNSIGNED NOT NULL,
  `felev` varchar(16) NOT NULL,
  `tipus` enum('eloadas','gyakorlat','labor') NOT NULL DEFAULT 'eloadas',
  `kapacitas` smallint(5) UNSIGNED DEFAULT 100,
  `terem` varchar(32) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

--
-- A tábla adatainak kiíratása `kurzus`
--

INSERT INTO `kurzus` (`id`, `tantargy_id`, `tanar_id`, `felev`, `tipus`, `kapacitas`, `terem`) VALUES
(1, 1, 1, '2024-25-1', 'eloadas', 200, 'A1'),
(2, 1, 4, '2024-25-1', 'gyakorlat', 30, 'B204'),
(3, 2, 3, '2024-25-2', 'eloadas', 180, 'A2'),
(4, 2, 4, '2024-25-2', 'gyakorlat', 30, 'B205'),
(5, 3, 2, '2024-25-1', 'eloadas', 150, 'C1'),
(6, 4, 1, '2024-25-2', 'eloadas', 120, 'C2'),
(7, 5, 2, '2024-25-1', 'eloadas', 120, 'D1'),
(8, 6, 2, '2024-25-2', 'eloadas', 120, 'D2'),
(9, 7, 5, '2024-25-1', 'eloadas', 100, 'E1'),
(10, 8, 1, '2024-25-2', 'eloadas', 150, 'LAB1'),
(11, 8, 4, '2024-25-2', 'labor', 24, 'LAB2'),
(12, 3, 2, '2024-25-2', 'gyakorlat', 30, 'C103');

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `tanar`
--

CREATE TABLE `tanar` (
  `id` int(10) UNSIGNED NOT NULL,
  `nev` varchar(120) NOT NULL,
  `tanszek` varchar(120) NOT NULL,
  `email` varchar(120) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

--
-- A tábla adatainak kiíratása `tanar`
--

INSERT INTO `tanar` (`id`, `nev`, `tanszek`, `email`) VALUES
(1, 'Dr. Kovács Péter', 'Informatika Tanszék', 'peter.kovacs@uni.hu'),
(2, 'Dr. Szabó Anna', 'Matematika Tanszék', 'anna.szabo@uni.hu'),
(3, 'Dr. Tóth László', 'Informatika Tanszék', 'laszlo.toth@uni.hu'),
(4, 'Dr. Nagy Júlia', 'Informatika Tanszék', 'julia.nagy@uni.hu'),
(5, 'Dr. Varga Márton', 'Fizika Tanszék', 'marton.varga@uni.hu');

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `tantargy`
--

CREATE TABLE `tantargy` (
  `id` int(10) UNSIGNED NOT NULL,
  `kod` varchar(16) NOT NULL,
  `nev` varchar(160) NOT NULL,
  `kredit` tinyint(3) UNSIGNED NOT NULL,
  `aktiv` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

--
-- A tábla adatainak kiíratása `tantargy`
--

INSERT INTO `tantargy` (`id`, `kod`, `nev`, `kredit`, `aktiv`) VALUES
(1, 'PROG1', 'Programozás I.', 5, 1),
(2, 'PROG2', 'Programozás II.', 5, 1),
(3, 'ADT1', 'Adatbázisok I.', 4, 1),
(4, 'ADT2', 'Adatbázisok II.', 5, 1),
(5, 'MATH1', 'Analízis I.', 4, 1),
(6, 'MATH2', 'Diszkrét matematika', 4, 1),
(7, 'STAT1', 'Statisztika alapok', 3, 1),
(8, 'WEB1', 'Webfejlesztés I.', 5, 1);

-- --------------------------------------------------------

--
-- A nézet helyettes szerkezete `v_hallgato_kredit`
-- (Lásd alább az aktuális nézetet)
--
CREATE TABLE `v_hallgato_kredit` (
`hallgato_id` int(10) unsigned
,`nev` varchar(120)
,`teljesitett_kredit` decimal(25,0)
);

-- --------------------------------------------------------

--
-- A nézet helyettes szerkezete `v_szak_hallgatoszam`
-- (Lásd alább az aktuális nézetet)
--
CREATE TABLE `v_szak_hallgatoszam` (
`szak` varchar(80)
,`hallgatoszam` bigint(21)
);

-- --------------------------------------------------------

--
-- A nézet helyettes szerkezete `v_tantargy_atlag`
-- (Lásd alább az aktuális nézetet)
--
CREATE TABLE `v_tantargy_atlag` (
`tantargy_id` int(10) unsigned
,`kod` varchar(16)
,`nev` varchar(160)
,`atlagjegy` decimal(7,4)
);

-- --------------------------------------------------------

--
-- Nézet szerkezete `v_hallgato_kredit`
--
DROP TABLE IF EXISTS `v_hallgato_kredit`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_hallgato_kredit`  AS SELECT `h`.`id` AS `hallgato_id`, `h`.`nev` AS `nev`, sum(case when `b`.`jegy` is not null and `b`.`jegy` >= 2 then `tt`.`kredit` else 0 end) AS `teljesitett_kredit` FROM (((`hallgato` `h` left join `beiratkozas` `b` on(`b`.`hallgato_id` = `h`.`id`)) left join `kurzus` `k` on(`k`.`id` = `b`.`kurzus_id`)) left join `tantargy` `tt` on(`tt`.`id` = `k`.`tantargy_id`)) GROUP BY `h`.`id`, `h`.`nev` ;

-- --------------------------------------------------------

--
-- Nézet szerkezete `v_szak_hallgatoszam`
--
DROP TABLE IF EXISTS `v_szak_hallgatoszam`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_szak_hallgatoszam`  AS SELECT `hallgato`.`szak` AS `szak`, count(0) AS `hallgatoszam` FROM `hallgato` GROUP BY `hallgato`.`szak` ;

-- --------------------------------------------------------

--
-- Nézet szerkezete `v_tantargy_atlag`
--
DROP TABLE IF EXISTS `v_tantargy_atlag`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_tantargy_atlag`  AS SELECT `t`.`id` AS `tantargy_id`, `t`.`kod` AS `kod`, `t`.`nev` AS `nev`, avg(`b`.`jegy`) AS `atlagjegy` FROM ((`tantargy` `t` join `kurzus` `k` on(`k`.`tantargy_id` = `t`.`id`)) join `beiratkozas` `b` on(`b`.`kurzus_id` = `k`.`id`)) WHERE `b`.`jegy` is not null GROUP BY `t`.`id`, `t`.`kod`, `t`.`nev` ;

--
-- Indexek a kiírt táblákhoz
--

--
-- A tábla indexei `beiratkozas`
--
ALTER TABLE `beiratkozas`
  ADD PRIMARY KEY (`hallgato_id`,`kurzus_id`),
  ADD KEY `ix_beiratkozas_kurzus` (`kurzus_id`);

--
-- A tábla indexei `hallgato`
--
ALTER TABLE `hallgato`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `neptun` (`neptun`),
  ADD UNIQUE KEY `uq_hallgato_email` (`email`);

--
-- A tábla indexei `kurzus`
--
ALTER TABLE `kurzus`
  ADD PRIMARY KEY (`id`),
  ADD KEY `ix_kurzus_tantargy` (`tantargy_id`),
  ADD KEY `ix_kurzus_tanar` (`tanar_id`);

--
-- A tábla indexei `tanar`
--
ALTER TABLE `tanar`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_tanar_email` (`email`);

--
-- A tábla indexei `tantargy`
--
ALTER TABLE `tantargy`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_tantargy_kod` (`kod`);

--
-- A kiírt táblák AUTO_INCREMENT értéke
--

--
-- AUTO_INCREMENT a táblához `hallgato`
--
ALTER TABLE `hallgato`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT a táblához `kurzus`
--
ALTER TABLE `kurzus`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT a táblához `tanar`
--
ALTER TABLE `tanar`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT a táblához `tantargy`
--
ALTER TABLE `tantargy`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- Megkötések a kiírt táblákhoz
--

--
-- Megkötések a táblához `beiratkozas`
--
ALTER TABLE `beiratkozas`
  ADD CONSTRAINT `fk_beiratkozas_hallgato` FOREIGN KEY (`hallgato_id`) REFERENCES `hallgato` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_beiratkozas_kurzus` FOREIGN KEY (`kurzus_id`) REFERENCES `kurzus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Megkötések a táblához `kurzus`
--
ALTER TABLE `kurzus`
  ADD CONSTRAINT `fk_kurzus_tanar` FOREIGN KEY (`tanar_id`) REFERENCES `tanar` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_kurzus_tantargy` FOREIGN KEY (`tantargy_id`) REFERENCES `tantargy` (`id`) ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
