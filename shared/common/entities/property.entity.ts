import { Column, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany, OneToOne } from 'typeorm';
import { PropertyDocument } from './property-document.entity';
import { PropertyMedia } from './property-media.entity';
import { User } from './user.entity';
import { Amenity } from './amenity.entity';
import { AbstractBaseReviewableEntity } from './common.entity';
import { Mortgage } from './mortgage.entity';
import { PropertyStatus, PropertyType } from '../types/property.type';
import { Currency } from 'types';

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

  @Column({ nullable: true })
  title: string;

  @Column({
    name: 'property_type',
    nullable: true,
    type: 'enum',
    enum: PropertyType
  })
  propertyType: string;

  @Column({ nullable: true })
  country: string;

  @Column({
    nullable: true,
    type: 'enum',
    enum: Currency,
  })
  currency: Currency;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  district: string;

  @Column({ name: 'zip_code', nullable: true })
  zipCode: string;

  @Column({ nullable: true })
  streetAddress: string;

  @Column({ nullable: false })
  nBedrooms: string

  @Column({ nullable: false })
  nBathrooms: string

  @Column({ nullable: false })
  nParkingSpots: string

  @Column({
    type: 'double precision',
    scale: 2,
    precision: 20,
    nullable: true,
  })
  price: number

  @Column({
    type: 'double precision',
    scale: 2,
    precision: 20,
    nullable: true,
  })
  longitude: number

  @Column({
    type: 'double precision',
    scale: 2,
    precision: 20,
    nullable: true,
  })
  latitude: number

  @Column({
    type: 'double precision',
    scale: 2,
    precision: 20,
    nullable: true,
  })
  area: number

  @Column({
    type: 'text',
    nullable: true
  })
  description: string

  @Column({
    type: 'enum',
    enum: PropertyStatus,
    default: PropertyStatus.PENDING,
  })
  status: PropertyStatus;
}
