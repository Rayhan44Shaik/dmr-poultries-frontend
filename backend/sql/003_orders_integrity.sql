-- =============================================================================
-- DMR Poultries — Orders integrity + performance
-- Keeps Orders on the existing Trip/Delivery source of truth.
-- No parallel order tables are introduced.
-- =============================================================================

-- Fast paths used by the Orders read model and assignment checks.
CREATE INDEX IF NOT EXISTS idx_trips_orders_day_flags
  ON trips (trip_date DESC, farm_step_submitted, delivery_step_submitted, deleted)
  WHERE deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_trip_deliveries_order_shop_trip
  ON trip_deliveries (shop_id, trip_id)
  WHERE remarks LIKE '[ORDER]%';

CREATE INDEX IF NOT EXISTS idx_trip_deliveries_order_ref
  ON trip_deliveries (trip_id, shop_id)
  WHERE remarks LIKE '[ORDER]%';

-- Only one active, vehicle-less ORD container is allowed per operational day.
-- Existing historical/manual trip numbers are unaffected.
CREATE OR REPLACE FUNCTION dmr_orders_validate_container()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.trip_no LIKE 'ORD-%'
     AND NEW.vehicle_id IS NULL
     AND NEW.deleted = FALSE THEN
    -- Serialize concurrent creation of the same day's collection container.
    PERFORM pg_advisory_xact_lock(
      hashtext('dmr-orders-container:' || NEW.trip_date::text)::bigint
    );

    IF EXISTS (
      SELECT 1
      FROM trips t
      WHERE t.trip_date = NEW.trip_date
        AND t.trip_no LIKE 'ORD-%'
        AND t.vehicle_id IS NULL
        AND t.deleted = FALSE
        AND t.id <> COALESCE(NEW.id, 0)
    ) THEN
      RAISE EXCEPTION 'An active Orders collection already exists for %', NEW.trip_date
        USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_validate_container ON trips;
CREATE TRIGGER trg_orders_validate_container
BEFORE INSERT OR UPDATE OF trip_no, trip_date, vehicle_id, deleted
ON trips
FOR EACH ROW
EXECUTE FUNCTION dmr_orders_validate_container();

-- Validate every persisted [ORDER] row at the database boundary.
-- This is intentionally a trigger rather than only application validation so
-- direct SQL, future APIs, imports, and the existing Trip Step 4 endpoint all
-- obey the same workflow rules.
CREATE OR REPLACE FUNCTION dmr_orders_validate_delivery()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  order_ref TEXT;
  order_trip_date DATE;
  order_finished BOOLEAN;
  order_deleted BOOLEAN;
  target_trip_date DATE;
  target_vehicle_id INTEGER;
  target_farm_submitted BOOLEAN;
  target_end_submitted BOOLEAN;
  duplicate_exists BOOLEAN;
  duplicate_same_trip BOOLEAN;
BEGIN
  IF COALESCE(NEW.remarks, '') NOT LIKE '[ORDER]%' THEN
    RETURN NEW;
  END IF;

  order_ref := substring(COALESCE(NEW.remarks, '') FROM '\[ORDER\][[:space:]]+O:([^[:space:]|]+)');
  IF order_ref IS NULL OR order_ref = '' THEN
    RAISE EXCEPTION 'Invalid Orders row: missing collection reference in remarks';
  END IF;

  IF NEW.shop_id IS NULL OR NEW.shop_id <= 0 THEN
    RAISE EXCEPTION 'Invalid Orders row: shop is required';
  END IF;

  SELECT t.trip_date, t.start_step_submitted, t.deleted
    INTO order_trip_date, order_finished, order_deleted
  FROM trips t
  WHERE t.trip_no = order_ref
    AND t.trip_no LIKE 'ORD-%'
    AND t.vehicle_id IS NULL
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orders collection % does not exist', order_ref
      USING ERRCODE = '23503';
  END IF;

  IF order_deleted THEN
    RAISE EXCEPTION 'Orders collection % is deleted', order_ref;
  END IF;

  IF NOT order_finished THEN
    RAISE EXCEPTION 'Orders collection % must be submitted before assignment', order_ref;
  END IF;

  SELECT t.trip_date, t.vehicle_id, t.farm_step_submitted, t.end_step_submitted
    INTO target_trip_date, target_vehicle_id, target_farm_submitted, target_end_submitted
  FROM trips t
  WHERE t.id = NEW.trip_id
    AND t.deleted = FALSE
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target trip % does not exist', NEW.trip_id
      USING ERRCODE = '23503';
  END IF;

  IF target_vehicle_id IS NULL OR target_vehicle_id <= 0 THEN
    RAISE EXCEPTION 'Orders can only be assigned to a vehicle trip';
  END IF;

  IF NOT target_farm_submitted THEN
    RAISE EXCEPTION 'Vehicle trip % is not eligible: Step 2 must be submitted first', NEW.trip_id;
  END IF;

  IF target_end_submitted THEN
    RAISE EXCEPTION 'Completed trip % is locked for Orders changes', NEW.trip_id;
  END IF;

  IF target_trip_date <> order_trip_date THEN
    RAISE EXCEPTION 'Orders collection % and vehicle trip % must use the same operational date',
      order_ref, NEW.trip_id;
  END IF;

  -- Serialize the business key (operational day + shop) so two concurrent
  -- assignments cannot both pass the duplicate check.
  PERFORM pg_advisory_xact_lock(
    hashtext('dmr-orders-shop:' || order_trip_date::text || ':' || NEW.shop_id::text)::bigint
  );

  SELECT EXISTS (
    SELECT 1
    FROM trip_deliveries d
    JOIN trips t ON t.id = d.trip_id
    WHERE d.shop_id = NEW.shop_id
      AND d.remarks LIKE '[ORDER]%'
      AND d.trip_id <> NEW.trip_id
      AND t.trip_date = order_trip_date
      AND t.deleted = FALSE
  ) INTO duplicate_exists;

  IF duplicate_exists THEN
    RAISE EXCEPTION 'Shop % is already assigned to another vehicle for %',
      NEW.shop_id, order_trip_date
      USING ERRCODE = '23505';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM trip_deliveries d
    WHERE d.trip_id = NEW.trip_id
      AND d.shop_id = NEW.shop_id
      AND d.remarks LIKE '[ORDER]%'
      AND d.id <> COALESCE(NEW.id, 0)
  ) INTO duplicate_same_trip;

  IF duplicate_same_trip THEN
    RAISE EXCEPTION 'Shop % appears more than once in Orders assignment for trip %',
      NEW.shop_id, NEW.trip_id
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_validate_delivery ON trip_deliveries;
CREATE TRIGGER trg_orders_validate_delivery
AFTER INSERT OR UPDATE OF trip_id, shop_id, remarks
ON trip_deliveries
FOR EACH ROW
EXECUTE FUNCTION dmr_orders_validate_delivery();

COMMENT ON FUNCTION dmr_orders_validate_container() IS
  'Protects the single active Orders collection container per operational day.';
COMMENT ON FUNCTION dmr_orders_validate_delivery() IS
  'Enforces Orders Step 2 eligibility, collection submission, same-day shop uniqueness, and trip locking at the database boundary.';
