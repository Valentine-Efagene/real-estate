import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Transaction } from './transaction.entity';
import { User } from './user.entity';
import { Currency } from '../types/common.type';

@Entity({ name: 'wallets' })
export class Wallet {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.wallets)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: number

  @Column({
    type: 'enum',
    enum: Currency
  })
  currency: number

  @Column({ name: 'customer_id' })
  customerId: string

  @Column({ name: 'bank_name' })
  bankName: string

  @Column({ name: 'account_number' })
  accountNumber: string

  @Column({ name: 'account_name' })
  accountName: string

  @Column({ type: 'decimal', precision: 65, scale: 2, nullable: true })
  balance: number;

  @Column()
  enabled: boolean

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Transaction, transaction => transaction.wallet)
  transactions: Transaction[]
}