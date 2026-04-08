-- Создание схемы
CREATE SCHEMA IF NOT EXISTS family_wallet;

-- Таблица групп
CREATE TABLE IF NOT EXISTS family_wallet.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    owner_id UUID NOT NULL,
    tariff_tier VARCHAR(50) DEFAULT 'START',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица участников
CREATE TABLE IF NOT EXISTS family_wallet.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES family_wallet.groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL, -- ORGANIZER, SPOUSE, SENIOR, TEEN, PRE_TEEN, CHILD
    can_request_money BOOLEAN DEFAULT false,
    can_manage_limits BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, user_id)
);

-- Таблица лимитов
CREATE TABLE IF NOT EXISTS family_wallet.limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES family_wallet.groups(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    period VARCHAR(20) DEFAULT 'MONTHLY', -- DAILY, WEEKLY, MONTHLY
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица целей
CREATE TABLE IF NOT EXISTS family_wallet.goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES family_wallet.groups(id) ON DELETE CASCADE,
    member_id UUID REFERENCES family_wallet.members(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    target_amount DECIMAL(15,2) NOT NULL,
    current_amount DECIMAL(15,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    deadline DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица задач (геймификация)
CREATE TABLE IF NOT EXISTS family_wallet.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES family_wallet.groups(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    reward_amount DECIMAL(10,2),
    xp_reward INTEGER DEFAULT 10,
    assigned_to UUID REFERENCES family_wallet.members(id),
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Индексы
CREATE INDEX idx_members_group ON family_wallet.members(group_id);
CREATE INDEX idx_members_user ON family_wallet.members(user_id);
CREATE INDEX idx_limits_group ON family_wallet.limits(group_id);
CREATE INDEX idx_goals_group ON family_wallet.goals(group_id);
CREATE INDEX idx_tasks_assigned ON family_wallet.tasks(assigned_to);