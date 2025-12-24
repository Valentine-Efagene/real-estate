import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Transaction } from './transaction.entity';
import { User } from './user.entity';
import { Currency } from '../types/social.enums';

@Entity({ name: 'wallets' })
export class Wallet {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.wallets)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  userId: number

  @Column({
    type: 'enum',
    enum: Currency
  })
  currency: number

  @Column({
  })
  customerId: string

  @Column({
  })
  bankName: string

  @Column({
  })
  accountNumber: string

  @Column({
  })
  accountName: string

  @Column({ type: 'decimal', precision: 65, scale: 2, nullable: true })
  balance: number;

  @Column()
  enabled: boolean

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Transaction, transaction => transaction.wallet)
  transactions: Transaction[]
}