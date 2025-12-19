import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Provider, TransactionType } from './transaction.type';
import { Wallet } from '../wallet/wallet.entity';
import { User } from '../user/user.entity';

@Entity({ name: 'prod_transactions' })
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
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

  @Column()
  walletId: number

  @ManyToOne(() => User, (user) => user.transactions)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  userId: number

  @Column({
    type: 'enum',
    enum: Provider
  })
  provider: Provider

  @Column()
  ref: string

  @Column({
    type: 'text'
  })
  metadata: string

  @Column({ type: 'decimal', precision: 65, scale: 2, nullable: true })
  amount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}