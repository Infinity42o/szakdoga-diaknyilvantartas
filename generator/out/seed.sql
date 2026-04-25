SET FOREIGN_KEY_CHECKS=0;
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
INSERT INTO `tanar` (`id`, `nev`, `tanszek`, `email`) VALUES
(1, 'Dr. Kovács Péter', 'Informatika Tanszék', 'peter.kovacs@uni.hu'),
(2, 'Dr. Szabó Anna', 'Matematika Tanszék', 'anna.szabo@uni.hu'),
(3, 'Dr. Tóth László', 'Informatika Tanszék', 'laszlo.toth@uni.hu'),
(4, 'Dr. Nagy Júlia', 'Informatika Tanszék', 'julia.nagy@uni.hu'),
(5, 'Dr. Varga Márton', 'Fizika Tanszék', 'marton.varga@uni.hu');
INSERT INTO `tantargy` (`id`, `kod`, `nev`, `kredit`, `aktiv`) VALUES
(1, 'PROG1', 'Programozás I.', 5, 1),
(2, 'PROG2', 'Programozás II.', 5, 1),
(3, 'ADT1', 'Adatbázisok I.', 4, 1),
(4, 'ADT2', 'Adatbázisok II.', 5, 1),
(5, 'MATH1', 'Analízis I.', 4, 1),
(6, 'MATH2', 'Diszkrét matematika', 4, 1),
(7, 'STAT1', 'Statisztika alapok', 3, 1),
(8, 'WEB1', 'Webfejlesztés I.', 5, 1);
SET FOREIGN_KEY_CHECKS=1;
