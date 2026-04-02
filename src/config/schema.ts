export const CREATE_USERS_TABLE = `
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    sector VARCHAR(50) NOT NULL,
    role VARCHAR(50) NOT NULL,
    is_authorized TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

export const CREATE_DOCS_TABLE = `
  CREATE TABLE IF NOT EXISTS documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doc_code VARCHAR(50) NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    filename VARCHAR(255) NULL,
    original_name VARCHAR(255) NULL,
    mimetype VARCHAR(100),
    size INT,
    sector VARCHAR(50) NOT NULL,
    category VARCHAR(20) NOT NULL,
    responsible VARCHAR(100),
    version VARCHAR(20),
    status VARCHAR(20) DEFAULT 'Revisão',
    is_published TINYINT(1) DEFAULT 0,
    creation_date DATE,
    parent_id INT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

export const CREATE_DOCUMENT_FILES_TABLE = `
  CREATE TABLE IF NOT EXISTS document_files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    document_id INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mimetype VARCHAR(100),
    size INT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
  );
`;

export const CREATE_DOCUMENT_APPROVALS_TABLE = `
  CREATE TABLE IF NOT EXISTS document_approvals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    document_id INT NOT NULL,
    user_id INT NOT NULL,
    status ENUM('Pendente', 'Aprovado', 'Rejeitado') DEFAULT 'Pendente',
    rejection_reason TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_approval (document_id, user_id)
  );
`;

export const CREATE_DOCUMENT_VISIBILITY_TABLE = `
  CREATE TABLE IF NOT EXISTS document_visibility (
    id INT AUTO_INCREMENT PRIMARY KEY,
    document_id INT NOT NULL,
    sector_name VARCHAR(50) NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
  );
`;

export const CREATE_NOTIFICATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    sector VARCHAR(50) NOT NULL,
    document_id INT,
    type VARCHAR(50) DEFAULT 'info',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
  );
`;

export const CREATE_USER_NOTIFICATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS user_notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    notification_id INT NOT NULL,
    user_id INT NOT NULL,
    is_read TINYINT(1) DEFAULT 0,
    read_at TIMESTAMP NULL,
    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY user_notif (user_id, notification_id)
  );
`;

export const CREATE_USER_FAVORITES_TABLE = `
  CREATE TABLE IF NOT EXISTS user_favorites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    document_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    UNIQUE KEY user_doc_fav (user_id, document_id)
  );
`;

export const CREATE_DOCUMENT_READINGS_TABLE = `
  CREATE TABLE IF NOT EXISTS document_readings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    document_id INT NOT NULL,
    user_id INT NOT NULL,
    status ENUM('Pendente', 'Confirmado') DEFAULT 'Pendente',
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_by INT NULL,
    confirmed_at TIMESTAMP NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_reading (document_id, user_id)
  );
`;

export const SCHEMA_QUERIES = [
  CREATE_USERS_TABLE,
  CREATE_DOCS_TABLE,
  CREATE_DOCUMENT_FILES_TABLE,
  CREATE_DOCUMENT_APPROVALS_TABLE,
  CREATE_DOCUMENT_VISIBILITY_TABLE,
  CREATE_NOTIFICATIONS_TABLE,
  CREATE_USER_NOTIFICATIONS_TABLE,
  CREATE_USER_FAVORITES_TABLE,
  CREATE_DOCUMENT_READINGS_TABLE
];
