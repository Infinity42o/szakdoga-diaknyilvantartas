-- composite_keys.sql
CREATE TABLE `A` (
  `a1` INT NOT NULL,
  `a2` INT NOT NULL,
  PRIMARY KEY (`a1`,`a2`)
);

CREATE TABLE `B` (
  `b1` INT NOT NULL,
  `b2` INT NOT NULL,
  CONSTRAINT `fk_b_a` FOREIGN KEY (`b1`,`b2`) REFERENCES `A` (`a1`,`a2`)
);
