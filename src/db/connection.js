import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = mysql.createPool({
  host: 'apossql-2f34d94b-immerzo2025-944f.k.aivencloud.com',
  user: 'avnadmin',
  password: 'AVNS_NV-d9DjQC4zCOYg2vhv',
  database: 'project_management',
  port: 16240,
  ssl: {
    rejectUnauthorized: false,
    ca: `-----BEGIN CERTIFICATE-----
MIIEUDCCArigAwIBAgIUKiqk/u+ik2fHMGykJFB4Owz1WhUwDQYJKoZIhvcNAQEM
BQAwQDE+MDwGA1UEAww1ZWQ3MzI5Y2YtZTY4YS00ZDRhLTllODItN2UzZmFjMzkz
NjEyIEdFTiAxIFByb2plY3QgQ0EwHhcNMjYwMTE4MTIzNjAyWhcNMzYwMTE2MTIz
NjAyWjBAMT4wPAYDVQQDDDVlZDczMjljZi1lNjhhLTRkNGEtOWU4Mi03ZTNmYWMz
OTM2MTIgR0VOIDEgUHJvamVjdCBDQTCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCC
AYoCggGBAMkpMkjhF9nHE1PyqNUITpKLRQylaN1KTJoNSRVwtD5Tk8Og/vjMBeeG
Aj5RLdf42tkMmZ+9cIbsFg6IC+s9FvBsypHAqn50pu6EAzkbcIBfqgro3Q5PK21D
NbmmqqL0z5Eai0gsGwad5fQJ2NrdK4zNK9vHKPeLidxgjO0F0otCOcFWFpH931LB
bl9lAvYKoN7PjuIoydLZKvlwNLPynDh/uoGYxk7VW43Rso3iTd5zkYqIl4AEVzxg
bFvb4w5KnoF4x+xCtdlYu7IJFuaeFQ9DRd43fQhlvre/7h+ZjRq6Pu7D/DErSxBv
qUxCvwmnGB45OFEKae2lIdVEvmUxZVQCjpEMDWqFl9DePqk7bkPFeHiX7SiNAjPl
sp4VhlnqS1GAYhu3U2rOCauDNbYgea2gxZIdCOhSCznZ2e9gpBnqe8EzubXXiOYt
VHtfUkvSd4QXfQ8vKWNzWaO58F/Q0wfBMqK3IBNQEV3hNUbeiB/DohddPw8cbP6h
bZvzDwkmQwIDAQABo0IwQDAdBgNVHQ4EFgQUBCAdbwxSOZFxMqG7s90mR5VeG2kw
EgYDVR0TAQH/BAgwBgEB/wIBADALBgNVHQ8EBAMCAQYwDQYJKoZIhvcNAQEMBQAD
ggGBAH/YKSCEQdwlTjrc4d1DQb7thQO4RY7jFDEkWJNqs2jhtJj+3gEA659BhIyV
YAFH6GM5feDQlMX+bBtJPP7iaBjoMZxPntnYphHO5TpXsxTOGRTR7Q64qMwsrJp4
qz9Zye5SeAflGVayvEHKz3ShFdc7802hC7+PqSsf+I7Fo4dlCz7WGLWq8lX7OWCq
wTwZ7l7OxDveakw1bWNCr66u9VtoCnkL7Gg/4/jFEeliAsvWA2aAJxxSI/qUXqkz
YgnVzFp6uc5X0B5eNL7RYbQjYkOBZt8cJOpVZ7D3rlRw3oC3hbLrPuDbu6uPQGaJ
tq3y7phqJUOIPktwLipSgxk1K9UOKwvQCctEsxs3/fgpDHbEXzgkTimV8G0AD6WO
fbZMfoNTIHNPltFHBLaB3D4dKlqOs5riH8omEgbbxDkxFnf0E9+ZBGuI6/fj8ZqM
rYnAXHNKq+M+kgdsY8e3YW3EExG2FAu8ZPxYpPjI2RIbHhUw4UBvWuBTv8vUuix8
AL3rig==
-----END CERTIFICATE-----`
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export async function initDB() {
  const connection = await pool.getConnection();
  try {
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    const statements = schema.split(';').filter(s => s.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        await connection.query(statement);
      }
    }

    // Migration: rename 'read' column to 'is_read' if it exists
    try {
      const [cols] = await connection.query(
        "SHOW COLUMNS FROM notifications LIKE 'read'"
      );
      if (cols.length > 0) {
        await connection.query('ALTER TABLE notifications CHANGE `read` `is_read` BOOLEAN DEFAULT FALSE');
        console.log('Migrated: renamed notifications.read to notifications.is_read');
      }
    } catch (e) {
      // column might not exist, ignore
    }

    console.log('Database schema initialized successfully');
  } finally {
    connection.release();
  }
}

export default pool;
