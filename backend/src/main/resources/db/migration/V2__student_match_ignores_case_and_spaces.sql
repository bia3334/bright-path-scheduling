-- A student typed as "le minh chau " at the front desk is the same student as
-- "Le Minh Chau". The student-in-one-place rule compares the normalised name.
ALTER TABLE lessons DROP CONSTRAINT lessons_student_busy;
ALTER TABLE lessons ADD CONSTRAINT lessons_student_busy EXCLUDE USING gist
  ((lower(btrim(student))) WITH =, slot WITH &&)
  WHERE (status <> 'cancelled');
