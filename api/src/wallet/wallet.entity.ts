import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Currency } from '../common/common.enum';
import { Transaction } from '../transaction/transaction.entity';
import { User } from '../user/user.entity';

@Entity({ name: 'prod_wallets' })
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