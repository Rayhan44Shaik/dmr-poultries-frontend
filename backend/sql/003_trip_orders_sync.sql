-- Orders belong to an existing Trip Entry trip. No ORD trips or day containers.
ALTER TABLE trips
  ADD COLUMN collection_finished BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN assignment_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN orders_hash TEXT NOT NULL DEFAULT '',
  ADD COLUMN whatsapp_confirmed_hash TEXT,
  ADD COLUMN whatsapp_message_id TEXT,
  ADD COLUMN request_key TEXT UNIQUE,
  ADD COLUMN request_hash TEXT,
  ADD COLUMN version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN farm_bird_type_id INTEGER REFERENCES bird_types(id),
  ADD COLUMN farm_bird_type TEXT,
  ADD COLUMN farm_gps_lat NUMERIC,
  ADD COLUMN farm_gps_lon NUMERIC,
  ADD COLUMN farm_gps_accuracy NUMERIC,
  ADD COLUMN farm_gps_time TIMESTAMPTZ;

CREATE TABLE trip_order_rows (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  serial_no INTEGER NOT NULL,
  boxes INTEGER NOT NULL CHECK (boxes >= 0),
  birds INTEGER NOT NULL DEFAULT 0 CHECK (birds >= 0),
  weight NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (weight >= 0),
  assigned_boxes INTEGER NOT NULL DEFAULT 0 CHECK (assigned_boxes >= 0 AND assigned_boxes <= boxes),
  assigned_birds INTEGER NOT NULL DEFAULT 0 CHECK (assigned_birds >= 0),
  assigned_weight NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (assigned_weight >= 0),
  assignment_serial_no INTEGER,
  UNIQUE (trip_id, shop_id)
);

ALTER TABLE trip_deliveries ADD COLUMN client_key TEXT;
UPDATE trip_deliveries SET client_key = 'delivery:' || id;
ALTER TABLE trip_deliveries ALTER COLUMN client_key SET NOT NULL;
CREATE UNIQUE INDEX trip_deliveries_client_key ON trip_deliveries(trip_id, client_key);
ALTER TABLE trip_deliveries ADD COLUMN order_row_id INTEGER REFERENCES trip_order_rows(id);

ALTER TABLE trip_diesel_entries
  ADD COLUMN client_key TEXT,
  ADD COLUMN amount NUMERIC(12,2),
  ADD COLUMN gps_lat NUMERIC,
  ADD COLUMN gps_lon NUMERIC,
  ADD COLUMN gps_accuracy NUMERIC,
  ADD COLUMN gps_captured_at TIMESTAMPTZ,
  ADD COLUMN submitted_at TIMESTAMPTZ;
UPDATE trip_diesel_entries SET client_key = 'diesel:' || id;
ALTER TABLE trip_diesel_entries ALTER COLUMN client_key SET NOT NULL;
CREATE UNIQUE INDEX trip_diesel_client_key ON trip_diesel_entries(trip_id, client_key);
