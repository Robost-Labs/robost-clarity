INSERT INTO organizations (id, name, domain, settings, created_at, updated_at) VALUES
('019b0c08-093c-43d9-936b-2c949d1968d5', 'Robost Final Test Corp', 'robost-test.com', '{"plan": "free", "created_via": "signup"}', '2025-12-27T01:21:58.969688Z', '2025-12-27T01:21:58.969688Z'),
('2fd5bf52-e8f5-428d-95dd-407a69fa1547', 'Symblll', 'symblll.com', '{"plan": "free", "created_via": "signup"}', '2025-12-28T17:05:54.933629Z', '2025-12-28T17:05:54.933629Z'),
('5f930dd5-26c4-4451-8f33-bae8d1e9e7b7', 'Test Organization', 'example.com', '{"plan": "free", "created_via": "signup"}', '2025-12-29T00:21:08.034848Z', '2025-12-29T00:21:08.034848Z'),
('3e9d175f-2cb7-4ac7-8cd0-7fae45019eaa', 'Test Corp A', 'testcompany7234.com', '{"plan": "free", "created_via": "signup"}', '2025-12-29T00:39:47.819454Z', '2025-12-29T00:39:47.819454Z')
ON CONFLICT (id) DO NOTHING;
