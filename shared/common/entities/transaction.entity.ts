import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Provider, TransactionType } from '../types/transaction.type';
import { Wallet } from './wallet.entity';
import { User } from './user.entity';

@Entity({ name: 'prod_transactions' })
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: 'type',
    type: 'enum',
    enum: TransactionType
  })
  type: TransactionType

  @ManyToOne(() => Wallet, wallet => wallet.transactions, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;

  @Column({ name: 'wallet_id' })
  walletId: number

  @ManyToOne(() => User, (user) => user.transactions)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: number

  @Column({
    name: 'provider',
    type: 'enum',
    enum: Provider
  })
  provider: Provider

  @Column({ name: 'ref' })
  ref: string

  @Column({
    name: 'metadata',
    type: 'text'
  })
  metadata: string

  @Column({ name: 'amount', type: 'decimal', precision: 65, scale: 2, nullable: true })
  amount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}