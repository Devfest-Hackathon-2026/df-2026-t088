CREATE OR REPLACE VIEW `${PROJECT_ID}.${DATASET}.stumbles_by_unit` AS
SELECT
  lessonKey,
  problem,
  pattern,
  COUNT(*) AS count
FROM `${PROJECT_ID}.${DATASET}.stumbles`
GROUP BY lessonKey, problem, pattern
HAVING COUNT(*) >= 5 AND COUNT(DISTINCT schoolHash) >= 2;

CREATE OR REPLACE VIEW `${PROJECT_ID}.${DATASET}.stumbles_by_week` AS
SELECT
  DATE_TRUNC(occurredAt, WEEK(MONDAY)) AS week,
  lessonKey,
  pattern,
  COUNT(*) AS count
FROM `${PROJECT_ID}.${DATASET}.stumbles`
GROUP BY week, lessonKey, pattern
HAVING COUNT(*) >= 5 AND COUNT(DISTINCT schoolHash) >= 2;
