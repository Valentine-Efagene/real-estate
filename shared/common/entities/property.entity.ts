import { Column, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany, OneToOne } from 'typeorm';
import { PropertyDocument } from './property-document.entity';
import { PropertyMedia } from './property-media.entity';
import { User } from './user.entity';
import { Amenity } from './amenity.entity';
import { AbstractBaseReviewableEntity } from './common.entity';
import { Mortgage } from './mortgage.entity';
import { PaymentPlan } from './payment-plan.entity';
import { Contract } from './contract.entity';
import { PropertyCategory, PropertyStatus, PropertyType } from '../types/property.type';
import { Currency } from '../types/common.type';

@Entity({ name: 'property' })
export class Property extends AbstractBaseReviewableEntity {
  @ManyToOne(() => User, {
    //eager: true,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', nullable: true })
  userId: number;

  @OneToMany(
    () => PropertyDocument,
    (propertyDocument) => propertyDocument.property,
  )
  documents: PropertyDocument[];

  @ManyToMany(() => Amenity)
  @JoinTable()
  amenities: Amenity[]

  @OneToMany(
    () => PropertyMedia,
    (propertyDocument) => propertyDocument.property,
  )

  media: PropertyMedia[];

  @OneToMany(() => Mortgage, (mortgage) => mortgage.property)
  mortgages: Mortgage[];

  @OneToMany(() => PaymentPlan, (plan) => plan.property)
  paymentPlans: PaymentPlan[];

  @OneToMany(() => Contract, (contract) => contract.property)
  contracts: Contract[];

  @OneToOne(() => PropertyMedia, {
    onDelete: 'SET NULL', // prevents FK errors if image is deleted
    onUpdate: 'CASCADE'
  })
  @JoinColumn({ name: 'display_image_id' })
  displayImage: PropertyMedia;

  @Column({
    name: 'display_image_id',
    nullable: true
  })
  displayImageId: number

  @Column({ name: 'title', nullable: true })
  title: string;

  @Column({
    name: 'category',
    nullable: true,
    type: 'enum',
    enum: PropertyCategory,
  })
  category: PropertyCategory;

  @Column({
    name: 'property_type',
    nullable: true,
    type: 'enum',
    enum: PropertyType
  })
  propertyType: string;

  @Column({ name: 'country', nullable: true })
  country: string;

  @Column({
    name: 'currency',
    nullable: true,
    type: 'enum',
    enum: Currency,
  })
  currency: Currency;

  @Column({ name: 'city', nullable: true })
  city: string;

  @Column({ name: 'district', nullable: true })
  district: string;

  @Column({ name: 'zip_code', nullable: true })
  zipCode: string;

  @Column({ name: 'street_address', nullable: true })
  streetAddress: string;

  @Column({ name: 'n_bedrooms', nullable: false })
  nBedrooms: string

  @Column({ name: 'n_bathrooms', nullable: false })
  nBathrooms: string

  @Column({ name: 'n_parking_spots', nullable: false })
  nParkingSpots: string

  @Column({
    name: 'price',
    type: 'double precision',
    scale: 2,
    precision: 20,
    nullable: true,
  })
  price: number

  @Column({
    name: 'longitude',
    type: 'double precision',
    scale: 2,
    precision: 20,
    nullable: true,
  })
  longitude: number

  @Column({
    name: 'latitude',
    type: 'double precision',
    scale: 2,
    precision: 20,
    nullable: true,
  })
  latitude: number

  @Column({
    name: 'area',
    type: 'double precision',
    scale: 2,
    precision: 20,
    nullable: true,
  })
  area: number

  @Column({
    name: 'description',
    type: 'text',
    nullable: true
  })
  description: string

  @Column({
    name: 'status',
    type: 'enum',
    enum: PropertyStatus,
    default: PropertyStatus.PENDING,
  })
  status: PropertyStatus;
}
