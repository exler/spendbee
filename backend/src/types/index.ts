export interface User {
  id: number;
  email: string;
  name: string;
  createdAt: Date;
}

export interface Group {
  id: number;
  name: string;
  description: string | null;
  createdBy: number;
  createdAt: Date;
}

export interface Expense {
  id: number;
  groupId: number;
  description: string;
  amount: number;
  paidBy: number;
  createdAt: Date;
}

export interface Balance {
  userId: number;
  userName: string;
  balance: number;
  isMock?: boolean;
}

export interface Settlement {
  id: number;
  groupId: number;
  fromUserId: number;
  toUserId: number;
  amount: number;
  createdAt: Date;
}
