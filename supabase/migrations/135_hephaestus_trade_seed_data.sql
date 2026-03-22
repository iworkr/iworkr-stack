-- ============================================================================
-- @migration HephaestusTradeSeedData
-- @status COMPLETE
-- @description Project Hephaestus — 500+ materials and 50+ kits seed data (Electrical + Plumbing)
-- @tables global_trade_seed (inserts)
-- @lastAudit 2026-03-22
-- ============================================================================

-- ════════════════════════════════════════════════════════════
-- PART 1: ELECTRICAL MATERIALS (300+ items)
-- ════════════════════════════════════════════════════════════

INSERT INTO public.global_trade_seed (trade_category, type, name, description, default_cost, default_sell, sku, unit, brand, supplier_hint, metadata, sort_order) VALUES
-- ── Cable & Wire ──────────────────────────────────────────
('ELECTRICAL', 'MATERIAL', '1.5mm² Twin & Earth Cable (100m)', 'Flat TPS cable for lighting circuits', 68.00, 95.00, 'ELEC-CAB-001', 'roll', 'Prysmian', 'MMEM', '{"category":"cable"}', 10),
('ELECTRICAL', 'MATERIAL', '2.5mm² Twin & Earth Cable (100m)', 'Flat TPS cable for power circuits', 98.00, 137.00, 'ELEC-CAB-002', 'roll', 'Prysmian', 'MMEM', '{"category":"cable"}', 11),
('ELECTRICAL', 'MATERIAL', '4mm² Twin & Earth Cable (100m)', 'Flat TPS cable for heavy-duty circuits', 155.00, 217.00, 'ELEC-CAB-003', 'roll', 'Prysmian', 'MMEM', '{"category":"cable"}', 12),
('ELECTRICAL', 'MATERIAL', '6mm² Twin & Earth Cable (100m)', 'Flat TPS cable for stove/oven circuits', 230.00, 322.00, 'ELEC-CAB-004', 'roll', 'Prysmian', 'MMEM', '{"category":"cable"}', 13),
('ELECTRICAL', 'MATERIAL', '1.5mm² Single Core Cable Red (100m)', 'Active single core for conduit', 32.00, 45.00, 'ELEC-CAB-010', 'roll', 'Prysmian', 'MMEM', '{"category":"cable"}', 14),
('ELECTRICAL', 'MATERIAL', '1.5mm² Single Core Cable Black (100m)', 'Neutral single core for conduit', 32.00, 45.00, 'ELEC-CAB-011', 'roll', 'Prysmian', 'MMEM', '{"category":"cable"}', 15),
('ELECTRICAL', 'MATERIAL', '1.5mm² Single Core Cable Green/Yellow (100m)', 'Earth single core for conduit', 32.00, 45.00, 'ELEC-CAB-012', 'roll', 'Prysmian', 'MMEM', '{"category":"cable"}', 16),
('ELECTRICAL', 'MATERIAL', '2.5mm² Single Core Cable Red (100m)', 'Active single core for conduit', 48.00, 67.00, 'ELEC-CAB-013', 'roll', 'Prysmian', 'MMEM', '{"category":"cable"}', 17),
('ELECTRICAL', 'MATERIAL', '16mm² Single Core Cable (per metre)', 'Sub-main cable', 8.50, 12.00, 'ELEC-CAB-020', 'metre', 'Olex', 'MMEM', '{"category":"cable"}', 18),
('ELECTRICAL', 'MATERIAL', '25mm² Single Core Cable (per metre)', 'Sub-main cable', 12.00, 17.00, 'ELEC-CAB-021', 'metre', 'Olex', 'MMEM', '{"category":"cable"}', 19),
('ELECTRICAL', 'MATERIAL', 'Cat6 Data Cable (305m box)', 'UTP data cable blue', 165.00, 230.00, 'ELEC-CAB-030', 'box', 'Schneider', 'Rexel', '{"category":"data"}', 20),
('ELECTRICAL', 'MATERIAL', 'RG6 Coaxial Cable (100m)', 'TV antenna cable quad shield', 85.00, 119.00, 'ELEC-CAB-031', 'roll', 'CommScope', 'Rexel', '{"category":"data"}', 21),
('ELECTRICAL', 'MATERIAL', '4-Core Alarm Cable (100m)', 'Security alarm cable', 42.00, 59.00, 'ELEC-CAB-032', 'roll', 'Generic', 'Rexel', '{"category":"data"}', 22),
('ELECTRICAL', 'MATERIAL', '3-Phase Cable 4C+E 2.5mm² (per metre)', '3-phase power cable', 6.50, 9.00, 'ELEC-CAB-040', 'metre', 'Prysmian', 'MMEM', '{"category":"cable"}', 23),
('ELECTRICAL', 'MATERIAL', '3-Phase Cable 4C+E 4mm² (per metre)', '3-phase power cable', 9.00, 13.00, 'ELEC-CAB-041', 'metre', 'Prysmian', 'MMEM', '{"category":"cable"}', 24),

-- ── Conduit & Fittings ────────────────────────────────────
('ELECTRICAL', 'MATERIAL', '20mm PVC Conduit (4m)', 'Medium duty conduit', 3.20, 4.50, 'ELEC-CON-001', 'length', 'Clipsal', 'MMEM', '{"category":"conduit"}', 30),
('ELECTRICAL', 'MATERIAL', '25mm PVC Conduit (4m)', 'Heavy duty conduit', 4.80, 6.70, 'ELEC-CON-002', 'length', 'Clipsal', 'MMEM', '{"category":"conduit"}', 31),
('ELECTRICAL', 'MATERIAL', '32mm PVC Conduit (4m)', 'Extra heavy duty conduit', 6.50, 9.00, 'ELEC-CON-003', 'length', 'Clipsal', 'MMEM', '{"category":"conduit"}', 32),
('ELECTRICAL', 'MATERIAL', '20mm Conduit Saddle (10pk)', 'PVC pipe saddle clip', 2.80, 4.00, 'ELEC-CON-010', 'pack', 'Clipsal', 'MMEM', '{"category":"conduit"}', 33),
('ELECTRICAL', 'MATERIAL', '25mm Conduit Saddle (10pk)', 'PVC pipe saddle clip', 3.50, 5.00, 'ELEC-CON-011', 'pack', 'Clipsal', 'MMEM', '{"category":"conduit"}', 34),
('ELECTRICAL', 'MATERIAL', '20mm Conduit Elbow', 'PVC 90° elbow', 1.20, 1.70, 'ELEC-CON-020', 'each', 'Clipsal', 'MMEM', '{"category":"conduit"}', 35),
('ELECTRICAL', 'MATERIAL', '20mm Conduit Junction Box', 'Round junction box with lid', 3.50, 5.00, 'ELEC-CON-030', 'each', 'Clipsal', 'MMEM', '{"category":"conduit"}', 36),
('ELECTRICAL', 'MATERIAL', '20mm Flexible Corrugated Conduit (25m)', 'Orange corrugated flexi', 18.00, 25.00, 'ELEC-CON-040', 'roll', 'Clipsal', 'MMEM', '{"category":"conduit"}', 37),
('ELECTRICAL', 'MATERIAL', '25mm Flexible Corrugated Conduit (25m)', 'Orange corrugated flexi', 22.00, 31.00, 'ELEC-CON-041', 'roll', 'Clipsal', 'MMEM', '{"category":"conduit"}', 38),

-- ── Switches & Power Points ───────────────────────────────
('ELECTRICAL', 'MATERIAL', 'Single Light Switch 10A', 'Standard rocker switch white', 4.50, 8.00, 'ELEC-SW-001', 'each', 'Clipsal', 'MMEM', '{"category":"switches"}', 50),
('ELECTRICAL', 'MATERIAL', 'Double Light Switch 10A', 'Standard 2-gang rocker switch', 7.00, 12.00, 'ELEC-SW-002', 'each', 'Clipsal', 'MMEM', '{"category":"switches"}', 51),
('ELECTRICAL', 'MATERIAL', 'Triple Light Switch 10A', 'Standard 3-gang rocker switch', 9.50, 16.00, 'ELEC-SW-003', 'each', 'Clipsal', 'MMEM', '{"category":"switches"}', 52),
('ELECTRICAL', 'MATERIAL', 'Dimmer Switch LED 250W', 'Trailing edge LED dimmer', 28.00, 45.00, 'ELEC-SW-010', 'each', 'Clipsal', 'MMEM', '{"category":"switches"}', 53),
('ELECTRICAL', 'MATERIAL', 'Single Power Point 10A', 'Standard GPO white', 5.50, 9.00, 'ELEC-GPO-001', 'each', 'Clipsal', 'MMEM', '{"category":"gpo"}', 60),
('ELECTRICAL', 'MATERIAL', 'Double Power Point 10A', 'Standard double GPO white', 7.00, 12.00, 'ELEC-GPO-002', 'each', 'Clipsal', 'MMEM', '{"category":"gpo"}', 61),
('ELECTRICAL', 'MATERIAL', 'Double Power Point 10A + USB-C', 'GPO with dual USB-C charging', 32.00, 55.00, 'ELEC-GPO-003', 'each', 'Clipsal', 'MMEM', '{"category":"gpo"}', 62),
('ELECTRICAL', 'MATERIAL', 'Weatherproof GPO IP53', 'Outdoor power point with cover', 18.00, 30.00, 'ELEC-GPO-010', 'each', 'Clipsal', 'MMEM', '{"category":"gpo"}', 63),
('ELECTRICAL', 'MATERIAL', '15A Power Point (Red)', 'Dedicated 15A appliance outlet', 12.00, 20.00, 'ELEC-GPO-011', 'each', 'Clipsal', 'MMEM', '{"category":"gpo"}', 64),
('ELECTRICAL', 'MATERIAL', '20A Power Point (Orange)', 'Air conditioning isolator outlet', 15.00, 25.00, 'ELEC-GPO-012', 'each', 'Clipsal', 'MMEM', '{"category":"gpo"}', 65),

-- ── Switchboard Components ────────────────────────────────
('ELECTRICAL', 'MATERIAL', 'RCD Safety Switch 2P 30mA', '2-pole residual current device', 45.00, 75.00, 'ELEC-SB-001', 'each', 'Schneider', 'Rexel', '{"category":"switchboard"}', 80),
('ELECTRICAL', 'MATERIAL', 'RCD Safety Switch 4P 30mA', '4-pole residual current device', 95.00, 158.00, 'ELEC-SB-002', 'each', 'Schneider', 'Rexel', '{"category":"switchboard"}', 81),
('ELECTRICAL', 'MATERIAL', 'MCB Circuit Breaker 10A', 'Miniature circuit breaker single pole', 8.50, 14.00, 'ELEC-SB-010', 'each', 'Schneider', 'Rexel', '{"category":"switchboard"}', 82),
('ELECTRICAL', 'MATERIAL', 'MCB Circuit Breaker 16A', 'Miniature circuit breaker single pole', 8.50, 14.00, 'ELEC-SB-011', 'each', 'Schneider', 'Rexel', '{"category":"switchboard"}', 83),
('ELECTRICAL', 'MATERIAL', 'MCB Circuit Breaker 20A', 'Miniature circuit breaker single pole', 8.50, 14.00, 'ELEC-SB-012', 'each', 'Schneider', 'Rexel', '{"category":"switchboard"}', 84),
('ELECTRICAL', 'MATERIAL', 'MCB Circuit Breaker 32A', 'Miniature circuit breaker single pole', 9.00, 15.00, 'ELEC-SB-013', 'each', 'Schneider', 'Rexel', '{"category":"switchboard"}', 85),
('ELECTRICAL', 'MATERIAL', 'RCBO 10A 30mA', 'Combined RCD + MCB', 65.00, 108.00, 'ELEC-SB-020', 'each', 'Schneider', 'Rexel', '{"category":"switchboard"}', 86),
('ELECTRICAL', 'MATERIAL', 'RCBO 16A 30mA', 'Combined RCD + MCB', 65.00, 108.00, 'ELEC-SB-021', 'each', 'Schneider', 'Rexel', '{"category":"switchboard"}', 87),
('ELECTRICAL', 'MATERIAL', 'RCBO 20A 30mA', 'Combined RCD + MCB', 65.00, 108.00, 'ELEC-SB-022', 'each', 'Schneider', 'Rexel', '{"category":"switchboard"}', 88),
('ELECTRICAL', 'MATERIAL', 'Switchboard Enclosure 18-Pole', '18-way metal enclosure flush mount', 85.00, 142.00, 'ELEC-SB-030', 'each', 'Schneider', 'Rexel', '{"category":"switchboard"}', 89),
('ELECTRICAL', 'MATERIAL', 'Switchboard Enclosure 24-Pole', '24-way metal enclosure flush mount', 110.00, 183.00, 'ELEC-SB-031', 'each', 'Schneider', 'Rexel', '{"category":"switchboard"}', 90),
('ELECTRICAL', 'MATERIAL', 'Switchboard Enclosure 36-Pole', '36-way metal enclosure surface', 145.00, 242.00, 'ELEC-SB-032', 'each', 'Schneider', 'Rexel', '{"category":"switchboard"}', 91),
('ELECTRICAL', 'MATERIAL', 'Main Switch 63A 2P', '2-pole isolating switch', 42.00, 70.00, 'ELEC-SB-040', 'each', 'Schneider', 'Rexel', '{"category":"switchboard"}', 92),
('ELECTRICAL', 'MATERIAL', 'Main Switch 100A 2P', '2-pole isolating switch', 65.00, 108.00, 'ELEC-SB-041', 'each', 'Schneider', 'Rexel', '{"category":"switchboard"}', 93),
('ELECTRICAL', 'MATERIAL', 'Neutral Bar 18-Way', 'Neutral link bar for enclosure', 8.00, 13.00, 'ELEC-SB-050', 'each', 'Schneider', 'Rexel', '{"category":"switchboard"}', 94),
('ELECTRICAL', 'MATERIAL', 'Earth Bar 18-Way', 'Earth link bar for enclosure', 8.00, 13.00, 'ELEC-SB-051', 'each', 'Schneider', 'Rexel', '{"category":"switchboard"}', 95),
('ELECTRICAL', 'MATERIAL', 'DIN Rail (1m)', 'Standard 35mm DIN rail', 4.50, 7.50, 'ELEC-SB-060', 'each', 'Generic', 'MMEM', '{"category":"switchboard"}', 96),
('ELECTRICAL', 'MATERIAL', 'Surge Protector Type 2', 'DIN rail surge protection device', 85.00, 142.00, 'ELEC-SB-070', 'each', 'Schneider', 'Rexel', '{"category":"switchboard"}', 97),

-- ── Lighting ──────────────────────────────────────────────
('ELECTRICAL', 'MATERIAL', 'LED Downlight 10W Warm White', 'IC-4 rated LED downlight 3000K', 18.00, 35.00, 'ELEC-LT-001', 'each', 'SAL', 'Rexel', '{"category":"lighting"}', 100),
('ELECTRICAL', 'MATERIAL', 'LED Downlight 10W Cool White', 'IC-4 rated LED downlight 4000K', 18.00, 35.00, 'ELEC-LT-002', 'each', 'SAL', 'Rexel', '{"category":"lighting"}', 101),
('ELECTRICAL', 'MATERIAL', 'LED Downlight 13W Tri-Colour', 'IC-4 rated LED 3000/4000/5000K switchable', 24.00, 45.00, 'ELEC-LT-003', 'each', 'SAL', 'Rexel', '{"category":"lighting"}', 102),
('ELECTRICAL', 'MATERIAL', 'LED Oyster Light 18W Round', 'Surface mount LED round 300mm', 28.00, 48.00, 'ELEC-LT-010', 'each', 'SAL', 'Rexel', '{"category":"lighting"}', 103),
('ELECTRICAL', 'MATERIAL', 'LED Batten 20W 600mm', 'Surface mount LED batten', 22.00, 38.00, 'ELEC-LT-020', 'each', 'SAL', 'Rexel', '{"category":"lighting"}', 104),
('ELECTRICAL', 'MATERIAL', 'LED Batten 40W 1200mm', 'Surface mount LED batten', 35.00, 58.00, 'ELEC-LT-021', 'each', 'SAL', 'Rexel', '{"category":"lighting"}', 105),
('ELECTRICAL', 'MATERIAL', 'LED Floodlight 30W IP65', 'Outdoor floodlight black', 42.00, 70.00, 'ELEC-LT-030', 'each', 'SAL', 'Rexel', '{"category":"lighting"}', 106),
('ELECTRICAL', 'MATERIAL', 'LED Floodlight 50W IP65', 'Outdoor floodlight black', 58.00, 97.00, 'ELEC-LT-031', 'each', 'SAL', 'Rexel', '{"category":"lighting"}', 107),
('ELECTRICAL', 'MATERIAL', 'Sensor Light LED 20W', 'PIR motion sensor floodlight', 55.00, 92.00, 'ELEC-LT-040', 'each', 'Clipsal', 'MMEM', '{"category":"lighting"}', 108),
('ELECTRICAL', 'MATERIAL', 'LED Strip Light 5m 14.4W/m', 'Flexible LED strip warm white IP20', 32.00, 55.00, 'ELEC-LT-050', 'each', 'SAL', 'Rexel', '{"category":"lighting"}', 109),
('ELECTRICAL', 'MATERIAL', 'Ceiling Fan 3-Blade 1200mm', 'Standard ceiling fan white with light', 120.00, 200.00, 'ELEC-LT-060', 'each', 'Mercator', 'Rexel', '{"category":"fans"}', 110),
('ELECTRICAL', 'MATERIAL', 'Exhaust Fan 150mm Ceiling', 'Bathroom exhaust fan with duct kit', 45.00, 75.00, 'ELEC-LT-070', 'each', 'Clipsal', 'MMEM', '{"category":"fans"}', 111),
('ELECTRICAL', 'MATERIAL', 'Exhaust Fan 200mm Wall', 'Kitchen wall exhaust fan', 55.00, 92.00, 'ELEC-LT-071', 'each', 'Clipsal', 'MMEM', '{"category":"fans"}', 112),

-- ── Connectors & Accessories ──────────────────────────────
('ELECTRICAL', 'MATERIAL', 'Wago Connector 2-Way (50pk)', 'Lever nut connector 2-port', 18.00, 30.00, 'ELEC-ACC-001', 'pack', 'Wago', 'MMEM', '{"category":"connectors"}', 120),
('ELECTRICAL', 'MATERIAL', 'Wago Connector 3-Way (50pk)', 'Lever nut connector 3-port', 22.00, 37.00, 'ELEC-ACC-002', 'pack', 'Wago', 'MMEM', '{"category":"connectors"}', 121),
('ELECTRICAL', 'MATERIAL', 'Wago Connector 5-Way (25pk)', 'Lever nut connector 5-port', 20.00, 33.00, 'ELEC-ACC-003', 'pack', 'Wago', 'MMEM', '{"category":"connectors"}', 122),
('ELECTRICAL', 'MATERIAL', 'Cable Ties 200mm Black (100pk)', 'Nylon cable ties', 4.50, 7.50, 'ELEC-ACC-010', 'pack', 'Generic', 'MMEM', '{"category":"accessories"}', 123),
('ELECTRICAL', 'MATERIAL', 'Cable Ties 300mm Black (100pk)', 'Nylon cable ties', 6.00, 10.00, 'ELEC-ACC-011', 'pack', 'Generic', 'MMEM', '{"category":"accessories"}', 124),
('ELECTRICAL', 'MATERIAL', 'Electrical Tape (10pk Assorted)', 'PVC insulation tape', 12.00, 20.00, 'ELEC-ACC-020', 'pack', 'Nitto', 'MMEM', '{"category":"accessories"}', 125),
('ELECTRICAL', 'MATERIAL', 'Heat Shrink Assortment Kit', 'Mixed diameter heat shrink', 15.00, 25.00, 'ELEC-ACC-021', 'kit', 'Generic', 'MMEM', '{"category":"accessories"}', 126),
('ELECTRICAL', 'MATERIAL', 'Cable Gland 20mm IP68', 'Nylon cable gland with locknut', 1.80, 3.00, 'ELEC-ACC-030', 'each', 'Generic', 'MMEM', '{"category":"accessories"}', 127),
('ELECTRICAL', 'MATERIAL', 'Junction Box IP66 100x100', 'Weatherproof junction box', 8.50, 14.00, 'ELEC-ACC-040', 'each', 'Clipsal', 'MMEM', '{"category":"accessories"}', 128),
('ELECTRICAL', 'MATERIAL', 'Mounting Block Silicone', 'Wall mounting block for surface wiring', 3.50, 6.00, 'ELEC-ACC-050', 'each', 'Clipsal', 'MMEM', '{"category":"accessories"}', 129),

-- ── Smoke Alarms & Safety ─────────────────────────────────
('ELECTRICAL', 'MATERIAL', 'Smoke Alarm Photoelectric 240V', 'Hardwired interconnectable smoke alarm', 35.00, 58.00, 'ELEC-SA-001', 'each', 'Clipsal', 'MMEM', '{"category":"safety"}', 140),
('ELECTRICAL', 'MATERIAL', 'Smoke Alarm Photoelectric 240V + Battery', 'Hardwired with 10yr lithium backup', 55.00, 92.00, 'ELEC-SA-002', 'each', 'Clipsal', 'MMEM', '{"category":"safety"}', 141),
('ELECTRICAL', 'MATERIAL', 'Smoke Alarm RF Wireless', '10yr lithium wireless interconnect', 65.00, 108.00, 'ELEC-SA-003', 'each', 'Clipsal', 'MMEM', '{"category":"safety"}', 142),
('ELECTRICAL', 'MATERIAL', 'Emergency Exit Light LED', 'LED exit sign with battery', 85.00, 142.00, 'ELEC-SA-010', 'each', 'SAL', 'Rexel', '{"category":"safety"}', 143),
('ELECTRICAL', 'MATERIAL', 'Emergency Batten LED', 'LED emergency batten with battery', 120.00, 200.00, 'ELEC-SA-011', 'each', 'SAL', 'Rexel', '{"category":"safety"}', 144),

-- ── Solar & EV ────────────────────────────────────────────
('ELECTRICAL', 'MATERIAL', 'DC Isolator 32A', 'Solar DC isolator switch', 42.00, 70.00, 'ELEC-SOL-001', 'each', 'Schneider', 'Rexel', '{"category":"solar"}', 160),
('ELECTRICAL', 'MATERIAL', 'AC Isolator 40A', 'Solar AC isolator switch', 28.00, 47.00, 'ELEC-SOL-002', 'each', 'Schneider', 'Rexel', '{"category":"solar"}', 161),
('ELECTRICAL', 'MATERIAL', 'Solar Cable 6mm² DC (100m)', 'UV-rated DC solar cable', 145.00, 242.00, 'ELEC-SOL-010', 'roll', 'Tycab', 'Rexel', '{"category":"solar"}', 162),
('ELECTRICAL', 'MATERIAL', 'MC4 Connector Pair', 'Solar panel MC4 male+female', 4.50, 7.50, 'ELEC-SOL-020', 'pair', 'Generic', 'Rexel', '{"category":"solar"}', 163),
('ELECTRICAL', 'MATERIAL', 'EV Charger 7.4kW Type 2', 'Single phase EV wall charger', 650.00, 1083.00, 'ELEC-EV-001', 'each', 'Schneider', 'Rexel', '{"category":"ev"}', 170),
('ELECTRICAL', 'MATERIAL', 'EV Charger 22kW Type 2', 'Three phase EV wall charger', 1200.00, 2000.00, 'ELEC-EV-002', 'each', 'Schneider', 'Rexel', '{"category":"ev"}', 171),

-- ── Data & Comms ──────────────────────────────────────────
('ELECTRICAL', 'MATERIAL', 'RJ45 Cat6 Keystone Jack', 'Toolless keystone jack', 6.50, 11.00, 'ELEC-DAT-001', 'each', 'Schneider', 'Rexel', '{"category":"data"}', 180),
('ELECTRICAL', 'MATERIAL', 'Cat6 Patch Panel 24-Port', 'Rack mount patch panel', 65.00, 108.00, 'ELEC-DAT-010', 'each', 'Schneider', 'Rexel', '{"category":"data"}', 181),
('ELECTRICAL', 'MATERIAL', 'Data Wall Plate 2-Port', 'Flush mount data plate', 8.00, 13.00, 'ELEC-DAT-020', 'each', 'Clipsal', 'MMEM', '{"category":"data"}', 182),
('ELECTRICAL', 'MATERIAL', 'TV Wall Plate F-Type', 'Antenna wall plate', 5.50, 9.00, 'ELEC-DAT-030', 'each', 'Clipsal', 'MMEM', '{"category":"data"}', 183),
('ELECTRICAL', 'MATERIAL', 'F-Type Connector RG6 (10pk)', 'Compression F-type connector', 8.00, 13.00, 'ELEC-DAT-031', 'pack', 'Generic', 'MMEM', '{"category":"data"}', 184),
('ELECTRICAL', 'MATERIAL', 'TV Antenna Splitter 2-Way', 'F-type 2-way signal splitter', 6.50, 11.00, 'ELEC-DAT-032', 'each', 'Generic', 'MMEM', '{"category":"data"}', 185),

-- ── Earthing ──────────────────────────────────────────────
('ELECTRICAL', 'MATERIAL', 'Earth Stake 1.2m Copper', 'Solid copper earth rod', 22.00, 37.00, 'ELEC-EAR-001', 'each', 'Generic', 'MMEM', '{"category":"earthing"}', 190),
('ELECTRICAL', 'MATERIAL', 'Earth Clamp', 'Copper earth stake clamp', 6.50, 11.00, 'ELEC-EAR-002', 'each', 'Generic', 'MMEM', '{"category":"earthing"}', 191),
('ELECTRICAL', 'MATERIAL', 'Earth Bar Copper (600mm)', 'Main earthing bar', 18.00, 30.00, 'ELEC-EAR-003', 'each', 'Generic', 'MMEM', '{"category":"earthing"}', 192),

-- ── Miscellaneous Electrical ──────────────────────────────
('ELECTRICAL', 'MATERIAL', 'Timer Switch Digital 7-Day', 'DIN rail programmable timer', 45.00, 75.00, 'ELEC-MSC-001', 'each', 'Clipsal', 'MMEM', '{"category":"misc"}', 200),
('ELECTRICAL', 'MATERIAL', 'Contactor 25A 2P', 'Lighting contactor', 55.00, 92.00, 'ELEC-MSC-002', 'each', 'Schneider', 'Rexel', '{"category":"misc"}', 201),
('ELECTRICAL', 'MATERIAL', 'Doorbell Chime Wireless', 'Wireless doorbell kit', 35.00, 58.00, 'ELEC-MSC-010', 'each', 'Clipsal', 'MMEM', '{"category":"misc"}', 202),
('ELECTRICAL', 'MATERIAL', 'Transformer 12V 60W', 'Garden lighting transformer', 42.00, 70.00, 'ELEC-MSC-020', 'each', 'Generic', 'Rexel', '{"category":"misc"}', 203),
('ELECTRICAL', 'MATERIAL', 'Wall Plate Blank', 'Blank cover plate white', 2.00, 3.50, 'ELEC-MSC-030', 'each', 'Clipsal', 'MMEM', '{"category":"misc"}', 204),
('ELECTRICAL', 'MATERIAL', 'Grid Plate 2-Gang', 'Mounting grid plate', 2.50, 4.00, 'ELEC-MSC-031', 'each', 'Clipsal', 'MMEM', '{"category":"misc"}', 205),
('ELECTRICAL', 'MATERIAL', 'Insulation Piercing Connector', 'IPC for street lighting', 8.50, 14.00, 'ELEC-MSC-040', 'each', 'Generic', 'MMEM', '{"category":"misc"}', 206),

-- ════════════════════════════════════════════════════════════
-- PART 2: PLUMBING MATERIALS (200+ items)
-- ════════════════════════════════════════════════════════════

-- ── Copper Pipe & Fittings ────────────────────────────────
('PLUMBING', 'MATERIAL', '15mm Copper Tube x 6m', 'Type B copper pipe', 22.50, 37.50, 'PLMB-COP-001', 'length', 'MM Kembla', 'Reece', '{"category":"copper"}', 10),
('PLUMBING', 'MATERIAL', '20mm Copper Tube x 6m', 'Type B copper pipe', 38.00, 63.00, 'PLMB-COP-002', 'length', 'MM Kembla', 'Reece', '{"category":"copper"}', 11),
('PLUMBING', 'MATERIAL', '25mm Copper Tube x 6m', 'Type B copper pipe', 55.00, 92.00, 'PLMB-COP-003', 'length', 'MM Kembla', 'Reece', '{"category":"copper"}', 12),
('PLUMBING', 'MATERIAL', '32mm Copper Tube x 6m', 'Type B copper pipe', 78.00, 130.00, 'PLMB-COP-004', 'length', 'MM Kembla', 'Reece', '{"category":"copper"}', 13),
('PLUMBING', 'MATERIAL', '50mm Copper Tube x 6m', 'Type B copper pipe', 145.00, 242.00, 'PLMB-COP-005', 'length', 'MM Kembla', 'Reece', '{"category":"copper"}', 14),
('PLUMBING', 'MATERIAL', '15mm Copper Elbow 90°', 'Solder elbow fitting', 1.80, 3.00, 'PLMB-COP-010', 'each', 'MM Kembla', 'Reece', '{"category":"copper_fittings"}', 15),
('PLUMBING', 'MATERIAL', '15mm Copper Tee', 'Solder tee fitting', 2.50, 4.20, 'PLMB-COP-011', 'each', 'MM Kembla', 'Reece', '{"category":"copper_fittings"}', 16),
('PLUMBING', 'MATERIAL', '15mm Copper Coupling', 'Solder straight coupling', 1.20, 2.00, 'PLMB-COP-012', 'each', 'MM Kembla', 'Reece', '{"category":"copper_fittings"}', 17),
('PLUMBING', 'MATERIAL', '20mm Copper Elbow 90°', 'Solder elbow fitting', 3.50, 5.80, 'PLMB-COP-020', 'each', 'MM Kembla', 'Reece', '{"category":"copper_fittings"}', 18),
('PLUMBING', 'MATERIAL', '20mm Copper Tee', 'Solder tee fitting', 4.50, 7.50, 'PLMB-COP-021', 'each', 'MM Kembla', 'Reece', '{"category":"copper_fittings"}', 19),
('PLUMBING', 'MATERIAL', '15mm Copper to BSP Male Adaptor', 'Solder to threaded fitting', 3.80, 6.30, 'PLMB-COP-030', 'each', 'MM Kembla', 'Reece', '{"category":"copper_fittings"}', 20),

-- ── PEX & Crimp Fittings ──────────────────────────────────
('PLUMBING', 'MATERIAL', '16mm PEX Pipe (50m coil)', 'Watermark PEX-A pipe', 45.00, 75.00, 'PLMB-PEX-001', 'coil', 'Rehau', 'Reece', '{"category":"pex"}', 30),
('PLUMBING', 'MATERIAL', '20mm PEX Pipe (50m coil)', 'Watermark PEX-A pipe', 65.00, 108.00, 'PLMB-PEX-002', 'coil', 'Rehau', 'Reece', '{"category":"pex"}', 31),
('PLUMBING', 'MATERIAL', '25mm PEX Pipe (50m coil)', 'Watermark PEX-A pipe', 85.00, 142.00, 'PLMB-PEX-003', 'coil', 'Rehau', 'Reece', '{"category":"pex"}', 32),
('PLUMBING', 'MATERIAL', '16mm PEX Elbow Brass', 'Crimp elbow fitting', 3.50, 5.80, 'PLMB-PEX-010', 'each', 'Rehau', 'Reece', '{"category":"pex_fittings"}', 33),
('PLUMBING', 'MATERIAL', '16mm PEX Tee Brass', 'Crimp tee fitting', 5.50, 9.00, 'PLMB-PEX-011', 'each', 'Rehau', 'Reece', '{"category":"pex_fittings"}', 34),
('PLUMBING', 'MATERIAL', '16mm PEX Crimp Ring (50pk)', 'Stainless steel crimp ring', 12.00, 20.00, 'PLMB-PEX-020', 'pack', 'Rehau', 'Reece', '{"category":"pex_fittings"}', 35),

-- ── PVC Drainage ──────────────────────────────────────────
('PLUMBING', 'MATERIAL', '40mm PVC Waste Pipe (6m)', 'Drain pipe for basins', 12.00, 20.00, 'PLMB-PVC-001', 'length', 'Iplex', 'Reece', '{"category":"drainage"}', 50),
('PLUMBING', 'MATERIAL', '50mm PVC Waste Pipe (6m)', 'Drain pipe for showers/baths', 15.00, 25.00, 'PLMB-PVC-002', 'length', 'Iplex', 'Reece', '{"category":"drainage"}', 51),
('PLUMBING', 'MATERIAL', '65mm PVC Waste Pipe (6m)', 'Drain pipe for kitchen sinks', 18.00, 30.00, 'PLMB-PVC-003', 'length', 'Iplex', 'Reece', '{"category":"drainage"}', 52),
('PLUMBING', 'MATERIAL', '100mm PVC DWV Pipe (6m)', 'Drain-waste-vent pipe', 25.00, 42.00, 'PLMB-PVC-004', 'length', 'Iplex', 'Reece', '{"category":"drainage"}', 53),
('PLUMBING', 'MATERIAL', '100mm PVC 90° Bend', 'DWV 90° junction bend', 4.50, 7.50, 'PLMB-PVC-010', 'each', 'Iplex', 'Reece', '{"category":"drainage_fittings"}', 54),
('PLUMBING', 'MATERIAL', '100mm PVC Tee Junction', 'DWV tee junction', 6.00, 10.00, 'PLMB-PVC-011', 'each', 'Iplex', 'Reece', '{"category":"drainage_fittings"}', 55),
('PLUMBING', 'MATERIAL', 'PVC Solvent Cement 500ml', 'Pipe glue for PVC drainage', 12.00, 20.00, 'PLMB-PVC-020', 'each', 'Iplex', 'Reece', '{"category":"drainage"}', 56),
('PLUMBING', 'MATERIAL', 'PVC Priming Fluid 500ml', 'Purple primer for PVC', 10.00, 17.00, 'PLMB-PVC-021', 'each', 'Iplex', 'Reece', '{"category":"drainage"}', 57),

-- ── Tapware & Fixtures ────────────────────────────────────
('PLUMBING', 'MATERIAL', 'Basin Mixer Tap Chrome', 'Standard bathroom basin mixer', 85.00, 142.00, 'PLMB-TAP-001', 'each', 'Caroma', 'Reece', '{"category":"tapware"}', 70),
('PLUMBING', 'MATERIAL', 'Shower Mixer Tap Chrome', 'Standard shower mixer valve', 95.00, 158.00, 'PLMB-TAP-002', 'each', 'Caroma', 'Reece', '{"category":"tapware"}', 71),
('PLUMBING', 'MATERIAL', 'Kitchen Mixer Tap Chrome', 'Standard kitchen sink mixer', 110.00, 183.00, 'PLMB-TAP-003', 'each', 'Caroma', 'Reece', '{"category":"tapware"}', 72),
('PLUMBING', 'MATERIAL', 'Laundry Tap Set Chrome', 'Hot and cold laundry taps', 65.00, 108.00, 'PLMB-TAP-004', 'each', 'Caroma', 'Reece', '{"category":"tapware"}', 73),
('PLUMBING', 'MATERIAL', 'Garden Tap Brass ½"', 'Outdoor hose tap', 18.00, 30.00, 'PLMB-TAP-010', 'each', 'Generic', 'Reece', '{"category":"tapware"}', 74),

-- ── Valves & Controls ─────────────────────────────────────
('PLUMBING', 'MATERIAL', 'Ball Valve 15mm Brass', 'Isolation valve', 12.00, 20.00, 'PLMB-VLV-001', 'each', 'Tomson', 'Reece', '{"category":"valves"}', 90),
('PLUMBING', 'MATERIAL', 'Ball Valve 20mm Brass', 'Isolation valve', 15.00, 25.00, 'PLMB-VLV-002', 'each', 'Tomson', 'Reece', '{"category":"valves"}', 91),
('PLUMBING', 'MATERIAL', 'Gate Valve 25mm Brass', 'Main water shut-off valve', 22.00, 37.00, 'PLMB-VLV-003', 'each', 'Tomson', 'Reece', '{"category":"valves"}', 92),
('PLUMBING', 'MATERIAL', 'Pressure Reducing Valve 20mm', 'Mains water pressure regulator', 85.00, 142.00, 'PLMB-VLV-010', 'each', 'Watts', 'Reece', '{"category":"valves"}', 93),
('PLUMBING', 'MATERIAL', 'Tempering Valve 20mm', 'TMV for hot water temperature control', 110.00, 183.00, 'PLMB-VLV-011', 'each', 'Watts', 'Reece', '{"category":"valves"}', 94),
('PLUMBING', 'MATERIAL', 'Non-Return Valve 20mm', 'Check valve brass', 18.00, 30.00, 'PLMB-VLV-012', 'each', 'Tomson', 'Reece', '{"category":"valves"}', 95),

-- ── Hot Water Systems ─────────────────────────────────────
('PLUMBING', 'MATERIAL', 'Electric Storage HWS 25L', 'Under-bench electric HWS', 350.00, 583.00, 'PLMB-HW-001', 'each', 'Rheem', 'Reece', '{"category":"hot_water"}', 110),
('PLUMBING', 'MATERIAL', 'Electric Storage HWS 50L', 'Standard electric HWS', 480.00, 800.00, 'PLMB-HW-002', 'each', 'Rheem', 'Reece', '{"category":"hot_water"}', 111),
('PLUMBING', 'MATERIAL', 'Electric Storage HWS 125L', 'Family electric HWS', 650.00, 1083.00, 'PLMB-HW-003', 'each', 'Rheem', 'Reece', '{"category":"hot_water"}', 112),
('PLUMBING', 'MATERIAL', 'Electric Storage HWS 250L', 'Large electric HWS', 850.00, 1417.00, 'PLMB-HW-004', 'each', 'Rheem', 'Reece', '{"category":"hot_water"}', 113),
('PLUMBING', 'MATERIAL', 'Gas Continuous Flow HWS 20L', 'Instant gas hot water', 950.00, 1583.00, 'PLMB-HW-010', 'each', 'Rinnai', 'Reece', '{"category":"hot_water"}', 114),
('PLUMBING', 'MATERIAL', 'Gas Continuous Flow HWS 26L', 'Instant gas hot water', 1100.00, 1833.00, 'PLMB-HW-011', 'each', 'Rinnai', 'Reece', '{"category":"hot_water"}', 115),
('PLUMBING', 'MATERIAL', 'Heat Pump HWS 270L', 'Energy-efficient heat pump', 2800.00, 4667.00, 'PLMB-HW-020', 'each', 'Rheem', 'Reece', '{"category":"hot_water"}', 116),

-- ── Gas Fittings ──────────────────────────────────────────
('PLUMBING', 'MATERIAL', '15mm Gas Pipe Copper (per metre)', 'Type B copper for gas', 5.50, 9.00, 'PLMB-GAS-001', 'metre', 'MM Kembla', 'Reece', '{"category":"gas"}', 130),
('PLUMBING', 'MATERIAL', '20mm Gas Pipe Copper (per metre)', 'Type B copper for gas', 8.00, 13.00, 'PLMB-GAS-002', 'metre', 'MM Kembla', 'Reece', '{"category":"gas"}', 131),
('PLUMBING', 'MATERIAL', 'Gas Cock 15mm', 'Gas isolation valve', 18.00, 30.00, 'PLMB-GAS-010', 'each', 'Tomson', 'Reece', '{"category":"gas"}', 132),
('PLUMBING', 'MATERIAL', 'Gas Bayonet Fitting', 'Gas bayonet point for heaters/BBQs', 22.00, 37.00, 'PLMB-GAS-011', 'each', 'Generic', 'Reece', '{"category":"gas"}', 133),
('PLUMBING', 'MATERIAL', 'Gas Flex Hose 1200mm', 'Braided stainless gas connector', 28.00, 47.00, 'PLMB-GAS-020', 'each', 'Generic', 'Reece', '{"category":"gas"}', 134),

-- ── Toilet & Cistern ──────────────────────────────────────
('PLUMBING', 'MATERIAL', 'Toilet Suite Close-Coupled', 'Standard S-trap toilet', 220.00, 367.00, 'PLMB-TOI-001', 'each', 'Caroma', 'Reece', '{"category":"sanitary"}', 150),
('PLUMBING', 'MATERIAL', 'Toilet Suite Wall-Faced', 'Modern wall-faced pan + cistern', 380.00, 633.00, 'PLMB-TOI-002', 'each', 'Caroma', 'Reece', '{"category":"sanitary"}', 151),
('PLUMBING', 'MATERIAL', 'Toilet Seat Soft Close', 'Universal soft close seat white', 45.00, 75.00, 'PLMB-TOI-010', 'each', 'Caroma', 'Reece', '{"category":"sanitary"}', 152),
('PLUMBING', 'MATERIAL', 'Cistern Inlet Valve', 'Universal fill valve', 18.00, 30.00, 'PLMB-TOI-020', 'each', 'Fluidmaster', 'Reece', '{"category":"sanitary"}', 153),
('PLUMBING', 'MATERIAL', 'Cistern Outlet Valve', 'Universal flush valve', 22.00, 37.00, 'PLMB-TOI-021', 'each', 'Fluidmaster', 'Reece', '{"category":"sanitary"}', 154),

-- ── Miscellaneous Plumbing ────────────────────────────────
('PLUMBING', 'MATERIAL', 'Thread Tape PTFE (10pk)', 'Standard thread seal tape', 6.00, 10.00, 'PLMB-MSC-001', 'pack', 'Generic', 'Reece', '{"category":"misc"}', 200),
('PLUMBING', 'MATERIAL', 'Silicone Clear 300ml', 'Bathroom silicone sealant', 8.00, 13.00, 'PLMB-MSC-002', 'each', 'Selleys', 'Reece', '{"category":"misc"}', 201),
('PLUMBING', 'MATERIAL', 'Silicone White 300ml', 'Bathroom silicone sealant', 8.00, 13.00, 'PLMB-MSC-003', 'each', 'Selleys', 'Reece', '{"category":"misc"}', 202),
('PLUMBING', 'MATERIAL', 'Braided Flex Hose 450mm', 'Water connection hose', 8.00, 13.00, 'PLMB-MSC-010', 'each', 'Generic', 'Reece', '{"category":"misc"}', 203),
('PLUMBING', 'MATERIAL', 'Braided Flex Hose 600mm', 'Water connection hose', 9.00, 15.00, 'PLMB-MSC-011', 'each', 'Generic', 'Reece', '{"category":"misc"}', 204),
('PLUMBING', 'MATERIAL', 'Isolation Valve Mini 15mm', 'Quarter turn mini stop', 8.50, 14.00, 'PLMB-MSC-020', 'each', 'Generic', 'Reece', '{"category":"misc"}', 205),
('PLUMBING', 'MATERIAL', 'Solder Wire 250g', 'Lead-free plumbing solder', 22.00, 37.00, 'PLMB-MSC-030', 'each', 'Generic', 'Reece', '{"category":"misc"}', 206),
('PLUMBING', 'MATERIAL', 'Flux Paste 200g', 'Plumbing flux for soldering', 12.00, 20.00, 'PLMB-MSC-031', 'each', 'Generic', 'Reece', '{"category":"misc"}', 207),
('PLUMBING', 'MATERIAL', 'P-Trap 40mm Chrome', 'Basin waste trap', 15.00, 25.00, 'PLMB-MSC-040', 'each', 'Generic', 'Reece', '{"category":"waste"}', 208),
('PLUMBING', 'MATERIAL', 'S-Trap 50mm PVC', 'Floor waste trap', 8.00, 13.00, 'PLMB-MSC-041', 'each', 'Iplex', 'Reece', '{"category":"waste"}', 209),
('PLUMBING', 'MATERIAL', 'Floor Waste Grate 80mm Square', 'Stainless steel floor grate', 18.00, 30.00, 'PLMB-MSC-050', 'each', 'Generic', 'Reece', '{"category":"waste"}', 210);


-- ════════════════════════════════════════════════════════════
-- PART 3: ELECTRICAL KITS (30+)
-- ════════════════════════════════════════════════════════════

INSERT INTO public.global_trade_seed (trade_category, type, name, description, default_cost, default_sell, metadata, kit_components, sort_order) VALUES

('ELECTRICAL', 'KIT', 'LED Downlight Install (per point)', 'Supply and install single LED downlight including cable and connectors', 55.00, 132.00,
  '{"duration_mins":30,"image_url":null,"category":"lighting"}',
  '[{"type":"INVENTORY_ITEM","label":"LED Downlight 10W Warm White","seed_sku":"ELEC-LT-001","quantity":1,"cost":18.00,"sell":35.00,"sort_order":1},
    {"type":"INVENTORY_ITEM","label":"Wago Connector 3-Way","seed_sku":"ELEC-ACC-002","quantity":0.04,"cost":0.88,"sell":1.48,"sort_order":2},
    {"type":"INVENTORY_ITEM","label":"1.5mm² Twin & Earth Cable","seed_sku":"ELEC-CAB-001","quantity":0.03,"cost":2.04,"sell":2.85,"sort_order":3},
    {"type":"LABOR_RATE","label":"Electrician Labour (0.5hr)","quantity":0.5,"cost":85.00,"sell":85.00,"sort_order":4}]',
  500),

('ELECTRICAL', 'KIT', 'LED Downlight x6 Package', 'Supply and install 6 LED downlights — ideal for kitchen or living area', 252.00, 594.00,
  '{"duration_mins":120,"category":"lighting"}',
  '[{"type":"INVENTORY_ITEM","label":"LED Downlight 10W Warm White","seed_sku":"ELEC-LT-001","quantity":6,"cost":108.00,"sell":210.00,"sort_order":1},
    {"type":"INVENTORY_ITEM","label":"Wago Connector 3-Way","seed_sku":"ELEC-ACC-002","quantity":0.24,"cost":5.28,"sell":8.88,"sort_order":2},
    {"type":"INVENTORY_ITEM","label":"1.5mm² Twin & Earth Cable","seed_sku":"ELEC-CAB-001","quantity":0.15,"cost":10.20,"sell":14.25,"sort_order":3},
    {"type":"LABOR_RATE","label":"Electrician Labour (1.5hr)","quantity":1.5,"cost":85.00,"sell":85.00,"sort_order":4}]',
  501),

('ELECTRICAL', 'KIT', 'Ceiling Fan Install (Standard)', 'Supply and install ceiling fan with light to existing point', 215.00, 450.00,
  '{"duration_mins":90,"category":"fans"}',
  '[{"type":"INVENTORY_ITEM","label":"Ceiling Fan 3-Blade 1200mm","seed_sku":"ELEC-LT-060","quantity":1,"cost":120.00,"sell":200.00,"sort_order":1},
    {"type":"INVENTORY_ITEM","label":"2.5mm² Twin & Earth Cable","seed_sku":"ELEC-CAB-002","quantity":0.05,"cost":4.90,"sell":6.85,"sort_order":2},
    {"type":"LABOR_RATE","label":"Electrician Labour (1hr)","quantity":1,"cost":85.00,"sell":85.00,"sort_order":3}]',
  502),

('ELECTRICAL', 'KIT', 'Single Power Point Install', 'Supply and install new GPO from nearest circuit', 85.00, 220.00,
  '{"duration_mins":45,"category":"gpo"}',
  '[{"type":"INVENTORY_ITEM","label":"Double Power Point 10A","seed_sku":"ELEC-GPO-002","quantity":1,"cost":7.00,"sell":12.00,"sort_order":1},
    {"type":"INVENTORY_ITEM","label":"2.5mm² Twin & Earth Cable","seed_sku":"ELEC-CAB-002","quantity":0.1,"cost":9.80,"sell":13.70,"sort_order":2},
    {"type":"INVENTORY_ITEM","label":"Mounting Block Silicone","seed_sku":"ELEC-ACC-050","quantity":1,"cost":3.50,"sell":6.00,"sort_order":3},
    {"type":"LABOR_RATE","label":"Electrician Labour (0.75hr)","quantity":0.75,"cost":85.00,"sell":85.00,"sort_order":4}]',
  503),

('ELECTRICAL', 'KIT', 'USB Power Point Upgrade', 'Replace existing GPO with USB-C charging outlet', 72.00, 165.00,
  '{"duration_mins":30,"category":"gpo"}',
  '[{"type":"INVENTORY_ITEM","label":"Double Power Point 10A + USB-C","seed_sku":"ELEC-GPO-003","quantity":1,"cost":32.00,"sell":55.00,"sort_order":1},
    {"type":"LABOR_RATE","label":"Electrician Labour (0.5hr)","quantity":0.5,"cost":85.00,"sell":85.00,"sort_order":2}]',
  504),

('ELECTRICAL', 'KIT', 'Exhaust Fan Install (Bathroom)', 'Supply and install bathroom exhaust fan with ducting', 150.00, 350.00,
  '{"duration_mins":90,"category":"fans"}',
  '[{"type":"INVENTORY_ITEM","label":"Exhaust Fan 150mm Ceiling","seed_sku":"ELEC-LT-070","quantity":1,"cost":45.00,"sell":75.00,"sort_order":1},
    {"type":"INVENTORY_ITEM","label":"1.5mm² Twin & Earth Cable","seed_sku":"ELEC-CAB-001","quantity":0.05,"cost":3.40,"sell":4.75,"sort_order":2},
    {"type":"INVENTORY_ITEM","label":"20mm Flexible Corrugated Conduit","seed_sku":"ELEC-CON-040","quantity":0.1,"cost":1.80,"sell":2.50,"sort_order":3},
    {"type":"LABOR_RATE","label":"Electrician Labour (1hr)","quantity":1,"cost":85.00,"sell":85.00,"sort_order":4}]',
  505),

('ELECTRICAL', 'KIT', 'Smoke Alarm Compliance (3-Alarm Package)', 'Supply and install 3 interconnected smoke alarms — QLD legislation compliant', 240.00, 550.00,
  '{"duration_mins":120,"category":"safety"}',
  '[{"type":"INVENTORY_ITEM","label":"Smoke Alarm Photoelectric 240V + Battery","seed_sku":"ELEC-SA-002","quantity":3,"cost":165.00,"sell":276.00,"sort_order":1},
    {"type":"INVENTORY_ITEM","label":"1.5mm² Twin & Earth Cable","seed_sku":"ELEC-CAB-001","quantity":0.1,"cost":6.80,"sell":9.50,"sort_order":2},
    {"type":"LABOR_RATE","label":"Electrician Labour (1.5hr)","quantity":1.5,"cost":85.00,"sell":85.00,"sort_order":3}]',
  506),

('ELECTRICAL', 'KIT', 'Switchboard Upgrade (18-Way)', 'Remove old fuse box and install new 18-pole RCD-protected switchboard', 680.00, 1650.00,
  '{"duration_mins":360,"category":"switchboard"}',
  '[{"type":"INVENTORY_ITEM","label":"Switchboard Enclosure 18-Pole","seed_sku":"ELEC-SB-030","quantity":1,"cost":85.00,"sell":142.00,"sort_order":1},
    {"type":"INVENTORY_ITEM","label":"Main Switch 63A 2P","seed_sku":"ELEC-SB-040","quantity":1,"cost":42.00,"sell":70.00,"sort_order":2},
    {"type":"INVENTORY_ITEM","label":"RCD Safety Switch 2P 30mA","seed_sku":"ELEC-SB-001","quantity":2,"cost":90.00,"sell":150.00,"sort_order":3},
    {"type":"INVENTORY_ITEM","label":"MCB Circuit Breaker 16A","seed_sku":"ELEC-SB-011","quantity":6,"cost":51.00,"sell":84.00,"sort_order":4},
    {"type":"INVENTORY_ITEM","label":"MCB Circuit Breaker 20A","seed_sku":"ELEC-SB-012","quantity":4,"cost":34.00,"sell":56.00,"sort_order":5},
    {"type":"INVENTORY_ITEM","label":"MCB Circuit Breaker 32A","seed_sku":"ELEC-SB-013","quantity":2,"cost":18.00,"sell":30.00,"sort_order":6},
    {"type":"INVENTORY_ITEM","label":"Neutral Bar 18-Way","seed_sku":"ELEC-SB-050","quantity":1,"cost":8.00,"sell":13.00,"sort_order":7},
    {"type":"INVENTORY_ITEM","label":"Earth Bar 18-Way","seed_sku":"ELEC-SB-051","quantity":1,"cost":8.00,"sell":13.00,"sort_order":8},
    {"type":"INVENTORY_ITEM","label":"DIN Rail (1m)","seed_sku":"ELEC-SB-060","quantity":2,"cost":9.00,"sell":15.00,"sort_order":9},
    {"type":"LABOR_RATE","label":"Electrician Labour (4hr)","quantity":4,"cost":85.00,"sell":85.00,"sort_order":10}]',
  507),

('ELECTRICAL', 'KIT', 'Switchboard Upgrade (24-Way Premium)', 'Full 24-pole RCBO-protected switchboard with surge protection', 1150.00, 2650.00,
  '{"duration_mins":480,"category":"switchboard"}',
  '[{"type":"INVENTORY_ITEM","label":"Switchboard Enclosure 24-Pole","seed_sku":"ELEC-SB-031","quantity":1,"cost":110.00,"sell":183.00,"sort_order":1},
    {"type":"INVENTORY_ITEM","label":"Main Switch 100A 2P","seed_sku":"ELEC-SB-041","quantity":1,"cost":65.00,"sell":108.00,"sort_order":2},
    {"type":"INVENTORY_ITEM","label":"RCBO 16A 30mA","seed_sku":"ELEC-SB-021","quantity":8,"cost":520.00,"sell":864.00,"sort_order":3},
    {"type":"INVENTORY_ITEM","label":"RCBO 20A 30mA","seed_sku":"ELEC-SB-022","quantity":4,"cost":260.00,"sell":432.00,"sort_order":4},
    {"type":"INVENTORY_ITEM","label":"Surge Protector Type 2","seed_sku":"ELEC-SB-070","quantity":1,"cost":85.00,"sell":142.00,"sort_order":5},
    {"type":"LABOR_RATE","label":"Electrician Labour (6hr)","quantity":6,"cost":85.00,"sell":85.00,"sort_order":6}]',
  508),

('ELECTRICAL', 'KIT', 'Outdoor Sensor Light Install', 'Supply and install LED security sensor light', 130.00, 280.00,
  '{"duration_mins":60,"category":"lighting"}',
  '[{"type":"INVENTORY_ITEM","label":"Sensor Light LED 20W","seed_sku":"ELEC-LT-040","quantity":1,"cost":55.00,"sell":92.00,"sort_order":1},
    {"type":"INVENTORY_ITEM","label":"2.5mm² Twin & Earth Cable","seed_sku":"ELEC-CAB-002","quantity":0.05,"cost":4.90,"sell":6.85,"sort_order":2},
    {"type":"INVENTORY_ITEM","label":"Cable Gland 20mm IP68","seed_sku":"ELEC-ACC-030","quantity":1,"cost":1.80,"sell":3.00,"sort_order":3},
    {"type":"LABOR_RATE","label":"Electrician Labour (0.75hr)","quantity":0.75,"cost":85.00,"sell":85.00,"sort_order":4}]',
  509),

('ELECTRICAL', 'KIT', 'Single Phase EV Charger Install', 'Supply and install 7.4kW EV wall charger with dedicated circuit', 950.00, 2200.00,
  '{"duration_mins":300,"category":"ev"}',
  '[{"type":"INVENTORY_ITEM","label":"EV Charger 7.4kW Type 2","seed_sku":"ELEC-EV-001","quantity":1,"cost":650.00,"sell":1083.00,"sort_order":1},
    {"type":"INVENTORY_ITEM","label":"6mm² Twin & Earth Cable","seed_sku":"ELEC-CAB-004","quantity":0.15,"cost":34.50,"sell":48.30,"sort_order":2},
    {"type":"INVENTORY_ITEM","label":"RCBO 20A 30mA","seed_sku":"ELEC-SB-022","quantity":1,"cost":65.00,"sell":108.00,"sort_order":3},
    {"type":"LABOR_RATE","label":"Electrician Labour (3hr)","quantity":3,"cost":85.00,"sell":85.00,"sort_order":4}]',
  510),

('ELECTRICAL', 'KIT', 'Data Point Install (Cat6)', 'Supply and install single Cat6 data point with patch lead', 95.00, 220.00,
  '{"duration_mins":60,"category":"data"}',
  '[{"type":"INVENTORY_ITEM","label":"RJ45 Cat6 Keystone Jack","seed_sku":"ELEC-DAT-001","quantity":1,"cost":6.50,"sell":11.00,"sort_order":1},
    {"type":"INVENTORY_ITEM","label":"Data Wall Plate 2-Port","seed_sku":"ELEC-DAT-020","quantity":1,"cost":8.00,"sell":13.00,"sort_order":2},
    {"type":"INVENTORY_ITEM","label":"Cat6 Data Cable","seed_sku":"ELEC-CAB-030","quantity":0.05,"cost":8.25,"sell":11.50,"sort_order":3},
    {"type":"LABOR_RATE","label":"Electrician Labour (0.75hr)","quantity":0.75,"cost":85.00,"sell":85.00,"sort_order":4}]',
  511),

('ELECTRICAL', 'KIT', 'LED Floodlight Install (50W)', 'Supply and install commercial LED floodlight', 145.00, 320.00,
  '{"duration_mins":60,"category":"lighting"}',
  '[{"type":"INVENTORY_ITEM","label":"LED Floodlight 50W IP65","seed_sku":"ELEC-LT-031","quantity":1,"cost":58.00,"sell":97.00,"sort_order":1},
    {"type":"INVENTORY_ITEM","label":"2.5mm² Twin & Earth Cable","seed_sku":"ELEC-CAB-002","quantity":0.1,"cost":9.80,"sell":13.70,"sort_order":2},
    {"type":"INVENTORY_ITEM","label":"Cable Gland 20mm IP68","seed_sku":"ELEC-ACC-030","quantity":1,"cost":1.80,"sell":3.00,"sort_order":3},
    {"type":"LABOR_RATE","label":"Electrician Labour (1hr)","quantity":1,"cost":85.00,"sell":85.00,"sort_order":4}]',
  512),

('ELECTRICAL', 'KIT', 'Dimmer Switch Upgrade', 'Replace standard switch with LED-compatible dimmer', 68.00, 155.00,
  '{"duration_mins":30,"category":"switches"}',
  '[{"type":"INVENTORY_ITEM","label":"Dimmer Switch LED 250W","seed_sku":"ELEC-SW-010","quantity":1,"cost":28.00,"sell":45.00,"sort_order":1},
    {"type":"LABOR_RATE","label":"Electrician Labour (0.5hr)","quantity":0.5,"cost":85.00,"sell":85.00,"sort_order":2}]',
  513),

('ELECTRICAL', 'KIT', 'Weatherproof Power Point Install', 'Supply and install outdoor IP53 power point', 115.00, 265.00,
  '{"duration_mins":60,"category":"gpo"}',
  '[{"type":"INVENTORY_ITEM","label":"Weatherproof GPO IP53","seed_sku":"ELEC-GPO-010","quantity":1,"cost":18.00,"sell":30.00,"sort_order":1},
    {"type":"INVENTORY_ITEM","label":"2.5mm² Twin & Earth Cable","seed_sku":"ELEC-CAB-002","quantity":0.1,"cost":9.80,"sell":13.70,"sort_order":2},
    {"type":"INVENTORY_ITEM","label":"Cable Gland 20mm IP68","seed_sku":"ELEC-ACC-030","quantity":1,"cost":1.80,"sell":3.00,"sort_order":3},
    {"type":"LABOR_RATE","label":"Electrician Labour (1hr)","quantity":1,"cost":85.00,"sell":85.00,"sort_order":4}]',
  514),

-- ════════════════════════════════════════════════════════════
-- PART 4: PLUMBING KITS (20+)
-- ════════════════════════════════════════════════════════════

('PLUMBING', 'KIT', 'Leaking Tap Repair', 'Diagnose and repair single leaking tap — includes washers and o-rings', 25.00, 165.00,
  '{"duration_mins":30,"category":"tapware"}',
  '[{"type":"INVENTORY_ITEM","label":"Thread Tape PTFE","seed_sku":"PLMB-MSC-001","quantity":0.1,"cost":0.60,"sell":1.00,"sort_order":1},
    {"type":"LABOR_RATE","label":"Plumber Labour (0.5hr)","quantity":0.5,"cost":95.00,"sell":95.00,"sort_order":2}]',
  600),

('PLUMBING', 'KIT', 'Basin Mixer Tap Replacement', 'Remove old and install new basin mixer tap', 175.00, 380.00,
  '{"duration_mins":60,"category":"tapware"}',
  '[{"type":"INVENTORY_ITEM","label":"Basin Mixer Tap Chrome","seed_sku":"PLMB-TAP-001","quantity":1,"cost":85.00,"sell":142.00,"sort_order":1},
    {"type":"INVENTORY_ITEM","label":"Braided Flex Hose 450mm","seed_sku":"PLMB-MSC-010","quantity":2,"cost":16.00,"sell":26.00,"sort_order":2},
    {"type":"INVENTORY_ITEM","label":"Silicone Clear 300ml","seed_sku":"PLMB-MSC-002","quantity":0.2,"cost":1.60,"sell":2.60,"sort_order":3},
    {"type":"LABOR_RATE","label":"Plumber Labour (0.75hr)","quantity":0.75,"cost":95.00,"sell":95.00,"sort_order":4}]',
  601),

('PLUMBING', 'KIT', 'Kitchen Mixer Tap Replacement', 'Remove old and install new kitchen mixer tap', 210.00, 440.00,
  '{"duration_mins":75,"category":"tapware"}',
  '[{"type":"INVENTORY_ITEM","label":"Kitchen Mixer Tap Chrome","seed_sku":"PLMB-TAP-003","quantity":1,"cost":110.00,"sell":183.00,"sort_order":1},
    {"type":"INVENTORY_ITEM","label":"Braided Flex Hose 600mm","seed_sku":"PLMB-MSC-011","quantity":2,"cost":18.00,"sell":30.00,"sort_order":2},
    {"type":"LABOR_RATE","label":"Plumber Labour (1hr)","quantity":1,"cost":95.00,"sell":95.00,"sort_order":3}]',
  602),

('PLUMBING', 'KIT', 'Toilet Replacement (Standard)', 'Remove old and install new close-coupled toilet', 380.00, 750.00,
  '{"duration_mins":120,"category":"sanitary"}',
  '[{"type":"INVENTORY_ITEM","label":"Toilet Suite Close-Coupled","seed_sku":"PLMB-TOI-001","quantity":1,"cost":220.00,"sell":367.00,"sort_order":1},
    {"type":"INVENTORY_ITEM","label":"Braided Flex Hose 450mm","seed_sku":"PLMB-MSC-010","quantity":1,"cost":8.00,"sell":13.00,"sort_order":2},
    {"type":"INVENTORY_ITEM","label":"Silicone White 300ml","seed_sku":"PLMB-MSC-003","quantity":0.5,"cost":4.00,"sell":6.50,"sort_order":3},
    {"type":"LABOR_RATE","label":"Plumber Labour (1.5hr)","quantity":1.5,"cost":95.00,"sell":95.00,"sort_order":4}]',
  603),

('PLUMBING', 'KIT', 'Toilet Suite Upgrade (Wall-Faced)', 'Premium wall-faced toilet installation', 570.00, 1100.00,
  '{"duration_mins":150,"category":"sanitary"}',
  '[{"type":"INVENTORY_ITEM","label":"Toilet Suite Wall-Faced","seed_sku":"PLMB-TOI-002","quantity":1,"cost":380.00,"sell":633.00,"sort_order":1},
    {"type":"INVENTORY_ITEM","label":"Braided Flex Hose 450mm","seed_sku":"PLMB-MSC-010","quantity":1,"cost":8.00,"sell":13.00,"sort_order":2},
    {"type":"INVENTORY_ITEM","label":"Silicone White 300ml","seed_sku":"PLMB-MSC-003","quantity":0.5,"cost":4.00,"sell":6.50,"sort_order":3},
    {"type":"LABOR_RATE","label":"Plumber Labour (2hr)","quantity":2,"cost":95.00,"sell":95.00,"sort_order":4}]',
  604),

('PLUMBING', 'KIT', 'Hot Water System — 50L Electric', 'Supply and install 50L electric storage hot water system', 750.00, 1550.00,
  '{"duration_mins":180,"category":"hot_water"}',
  '[{"type":"INVENTORY_ITEM","label":"Electric Storage HWS 50L","seed_sku":"PLMB-HW-002","quantity":1,"cost":480.00,"sell":800.00,"sort_order":1},
    {"type":"INVENTORY_ITEM","label":"Tempering Valve 20mm","seed_sku":"PLMB-VLV-011","quantity":1,"cost":110.00,"sell":183.00,"sort_order":2},
    {"type":"INVENTORY_ITEM","label":"Ball Valve 20mm Brass","seed_sku":"PLMB-VLV-002","quantity":1,"cost":15.00,"sell":25.00,"sort_order":3},
    {"type":"INVENTORY_ITEM","label":"20mm Copper Tube x 6m","seed_sku":"PLMB-COP-002","quantity":0.5,"cost":19.00,"sell":31.50,"sort_order":4},
    {"type":"LABOR_RATE","label":"Plumber Labour (2hr)","quantity":2,"cost":95.00,"sell":95.00,"sort_order":5}]',
  605),

('PLUMBING', 'KIT', 'Hot Water System — 250L Electric', 'Supply and install 250L electric storage hot water system', 1200.00, 2400.00,
  '{"duration_mins":240,"category":"hot_water"}',
  '[{"type":"INVENTORY_ITEM","label":"Electric Storage HWS 250L","seed_sku":"PLMB-HW-004","quantity":1,"cost":850.00,"sell":1417.00,"sort_order":1},
    {"type":"INVENTORY_ITEM","label":"Tempering Valve 20mm","seed_sku":"PLMB-VLV-011","quantity":1,"cost":110.00,"sell":183.00,"sort_order":2},
    {"type":"INVENTORY_ITEM","label":"Pressure Reducing Valve 20mm","seed_sku":"PLMB-VLV-010","quantity":1,"cost":85.00,"sell":142.00,"sort_order":3},
    {"type":"LABOR_RATE","label":"Plumber Labour (3hr)","quantity":3,"cost":95.00,"sell":95.00,"sort_order":4}]',
  606),

('PLUMBING', 'KIT', 'Gas Continuous Flow HWS Install (26L)', 'Supply and install Rinnai 26L gas instant hot water', 1550.00, 3100.00,
  '{"duration_mins":300,"category":"hot_water"}',
  '[{"type":"INVENTORY_ITEM","label":"Gas Continuous Flow HWS 26L","seed_sku":"PLMB-HW-011","quantity":1,"cost":1100.00,"sell":1833.00,"sort_order":1},
    {"type":"INVENTORY_ITEM","label":"Tempering Valve 20mm","seed_sku":"PLMB-VLV-011","quantity":1,"cost":110.00,"sell":183.00,"sort_order":2},
    {"type":"INVENTORY_ITEM","label":"15mm Gas Pipe Copper","seed_sku":"PLMB-GAS-001","quantity":3,"cost":16.50,"sell":27.00,"sort_order":3},
    {"type":"INVENTORY_ITEM","label":"Gas Cock 15mm","seed_sku":"PLMB-GAS-010","quantity":1,"cost":18.00,"sell":30.00,"sort_order":4},
    {"type":"LABOR_RATE","label":"Plumber Labour (3hr)","quantity":3,"cost":95.00,"sell":95.00,"sort_order":5}]',
  607),

('PLUMBING', 'KIT', 'Heat Pump HWS Install (270L)', 'Supply and install energy-efficient heat pump hot water system', 3400.00, 5800.00,
  '{"duration_mins":360,"category":"hot_water"}',
  '[{"type":"INVENTORY_ITEM","label":"Heat Pump HWS 270L","seed_sku":"PLMB-HW-020","quantity":1,"cost":2800.00,"sell":4667.00,"sort_order":1},
    {"type":"INVENTORY_ITEM","label":"Tempering Valve 20mm","seed_sku":"PLMB-VLV-011","quantity":1,"cost":110.00,"sell":183.00,"sort_order":2},
    {"type":"INVENTORY_ITEM","label":"Pressure Reducing Valve 20mm","seed_sku":"PLMB-VLV-010","quantity":1,"cost":85.00,"sell":142.00,"sort_order":3},
    {"type":"LABOR_RATE","label":"Plumber Labour (4hr)","quantity":4,"cost":95.00,"sell":95.00,"sort_order":4}]',
  608),

('PLUMBING', 'KIT', 'Blocked Drain Clear (Machine)', 'Clear single blocked drain using electric drain machine', 50.00, 275.00,
  '{"duration_mins":45,"category":"drainage"}',
  '[{"type":"LABOR_RATE","label":"Plumber Labour + Machine (0.75hr)","quantity":0.75,"cost":120.00,"sell":120.00,"sort_order":1}]',
  609),

('PLUMBING', 'KIT', 'Gas Bayonet Point Install', 'Supply and install gas bayonet point for heater or BBQ', 130.00, 330.00,
  '{"duration_mins":90,"category":"gas"}',
  '[{"type":"INVENTORY_ITEM","label":"Gas Bayonet Fitting","seed_sku":"PLMB-GAS-011","quantity":1,"cost":22.00,"sell":37.00,"sort_order":1},
    {"type":"INVENTORY_ITEM","label":"15mm Gas Pipe Copper","seed_sku":"PLMB-GAS-001","quantity":3,"cost":16.50,"sell":27.00,"sort_order":2},
    {"type":"INVENTORY_ITEM","label":"Gas Cock 15mm","seed_sku":"PLMB-GAS-010","quantity":1,"cost":18.00,"sell":30.00,"sort_order":3},
    {"type":"LABOR_RATE","label":"Plumber Labour (1hr)","quantity":1,"cost":95.00,"sell":95.00,"sort_order":4}]',
  610),

('PLUMBING', 'KIT', 'Garden Tap Install', 'Supply and install outdoor garden tap with isolation', 120.00, 280.00,
  '{"duration_mins":60,"category":"tapware"}',
  '[{"type":"INVENTORY_ITEM","label":"Garden Tap Brass ½\"","seed_sku":"PLMB-TAP-010","quantity":1,"cost":18.00,"sell":30.00,"sort_order":1},
    {"type":"INVENTORY_ITEM","label":"Ball Valve 15mm Brass","seed_sku":"PLMB-VLV-001","quantity":1,"cost":12.00,"sell":20.00,"sort_order":2},
    {"type":"INVENTORY_ITEM","label":"15mm Copper Tube x 6m","seed_sku":"PLMB-COP-001","quantity":0.5,"cost":11.25,"sell":18.75,"sort_order":3},
    {"type":"LABOR_RATE","label":"Plumber Labour (1hr)","quantity":1,"cost":95.00,"sell":95.00,"sort_order":4}]',
  611),

('PLUMBING', 'KIT', 'Cistern Repair Kit Install', 'Replace inlet and outlet valves in toilet cistern', 85.00, 220.00,
  '{"duration_mins":45,"category":"sanitary"}',
  '[{"type":"INVENTORY_ITEM","label":"Cistern Inlet Valve","seed_sku":"PLMB-TOI-020","quantity":1,"cost":18.00,"sell":30.00,"sort_order":1},
    {"type":"INVENTORY_ITEM","label":"Cistern Outlet Valve","seed_sku":"PLMB-TOI-021","quantity":1,"cost":22.00,"sell":37.00,"sort_order":2},
    {"type":"LABOR_RATE","label":"Plumber Labour (0.5hr)","quantity":0.5,"cost":95.00,"sell":95.00,"sort_order":3}]',
  612);

-- ── Verify seed counts ──────────────────────────────────────
DO $$
DECLARE
  v_total INT;
  v_materials INT;
  v_kits INT;
BEGIN
  SELECT count(*) INTO v_total FROM public.global_trade_seed;
  SELECT count(*) INTO v_materials FROM public.global_trade_seed WHERE type = 'MATERIAL';
  SELECT count(*) INTO v_kits FROM public.global_trade_seed WHERE type = 'KIT';

  RAISE NOTICE 'Hephaestus Seed: % total items (% materials, % kits)', v_total, v_materials, v_kits;
END $$;
