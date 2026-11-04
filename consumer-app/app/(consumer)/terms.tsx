import React from 'react';
import { LegalDoc, LegalSection } from '../../src/components/LegalDoc';

export const SECTIONS: LegalSection[] = [
  {
    heading: 'Acceptance of Terms',
    body: [
      'These Terms & Conditions ("Terms") govern your use of the Shinitz platform, apps and services. By creating an account or placing an order you agree to these Terms, our Privacy Policy and any policies referenced here.',
      'Shinitz operates as an intermediary connecting customers with independent restaurants, kirana stores and delivery partners, and is governed by Indian law including the Consumer Protection (E-Commerce) Rules, 2020.',
    ],
  },
  {
    heading: 'Customer Responsibilities',
    body: [
      'Provide accurate account, address and contact details, and keep your login/OTP confidential.',
      'Be available to receive your order at the address provided and pay the amounts due, including item price, taxes and the applicable distance-based delivery fee.',
      'Use the service lawfully; do not place fraudulent, abusive or fake orders, and treat delivery and store partners with respect.',
    ],
  },
  {
    heading: 'Restaurant / Store Partner Responsibilities',
    body: [
      'Maintain valid licences (including FSSAI and, where applicable, GST), accurate menus, pricing and availability, and comply with food safety, hygiene and labelling laws.',
      'Prepare orders correctly and on time, and honour the commission and settlement terms agreed with Shinitz.',
    ],
  },
  {
    heading: 'Delivery Partner Responsibilities',
    body: [
      'Hold valid documents and a roadworthy vehicle, follow traffic and safety laws, and handle orders hygienically and honestly.',
      'Deliver to the correct customer (verified by OTP where applicable) and not tamper with orders. Earnings are paid to the verified UPI/bank account per the payout terms.',
    ],
  },
  {
    heading: 'Pricing, Delivery Fee & Taxes',
    body: [
      'Item prices are set by stores. A delivery fee is calculated dynamically based on the actual road distance between the store and your delivery address at the published per-kilometre rate, and is shown to you before you pay.',
      'Applicable taxes (e.g., GST) are charged as per law. The amount payable is confirmed at checkout and computed authoritatively by our servers.',
    ],
  },
  {
    heading: 'Cancellation Policy',
    body: [
      'You may cancel before a store accepts/begins preparing your order, usually without charge. Once preparation has begun, cancellation may attract a charge to cover food and rider costs.',
      'Shinitz or a store may cancel an order due to unavailability, suspected fraud, or inability to serve your location, in which case eligible amounts are refunded.',
    ],
  },
  {
    heading: 'Refund Policy',
    body: [
      'Refunds for eligible cancellations, undelivered orders or proven quality issues are credited to the original payment method or your Shinitz wallet, typically within 5–7 business days depending on your bank/PSP.',
      'Refund decisions for quality complaints are made reasonably after review; raising a complaint promptly with photos helps resolution.',
    ],
  },
  {
    heading: 'Delivery Delays',
    body: [
      'Delivery times are estimates and may vary due to traffic, weather, store preparation time, address accuracy and demand. Estimated delays do not by themselves entitle a refund unless the order is undelivered or cancelled.',
    ],
  },
  {
    heading: 'Force Majeure',
    body: [
      'Shinitz is not liable for failure or delay caused by events beyond reasonable control, including natural disasters, strikes, civil unrest, network/utility failures, government action, pandemics or other force-majeure events.',
    ],
  },
  {
    heading: 'Account Suspension',
    body: [
      'We may suspend or terminate accounts that violate these Terms, engage in fraud or abuse, repeatedly cancel/refuse orders, or misuse the platform. Where appropriate we will give notice and an opportunity to respond.',
    ],
  },
  {
    heading: 'Account Deletion & Recovery',
    body: [
      'You may request deletion of your account at any time from the app. On confirmation (verified by OTP), your account is deactivated immediately and scheduled for permanent deletion after a 30-day recovery period.',
      'During the 30-day period you may log in at any time to restore your account in full. After the period expires, deletion is permanent and the account cannot be recovered; a new account starts fresh.',
      'Deletion cannot be requested while an order or settlement is in progress. Records of completed orders, invoices, payouts and other financial transactions are retained in anonymised form as required by tax, accounting, fraud-prevention and other applicable laws.',
      'We may decline or reverse a deletion request where necessary to investigate fraud, enforce these Terms, or comply with a legal obligation.',
    ],
  },
  {
    heading: 'Intellectual Property',
    body: [
      'The Shinitz name, logo, app, content and software are owned by Shinitz and protected by law. You may not copy, modify, reverse-engineer or use them except as permitted to use the service.',
    ],
  },
  {
    heading: 'Commission & Settlement',
    body: [
      'Store and delivery partners are paid net of the agreed commission and applicable deductions, settled on the cycle communicated to them. Settlement statements are available in the partner app/panel.',
    ],
  },
  {
    heading: 'Liability Limitation',
    body: [
      'To the maximum extent permitted by law, Shinitz acts as an intermediary and is not liable for the acts/omissions of independent stores or delivery partners. Our aggregate liability for any claim is limited to the value of the relevant order.',
      'Nothing in these Terms excludes liability that cannot be excluded under applicable law.',
    ],
  },
  {
    heading: 'Dispute Resolution & Governing Law',
    body: [
      'These Terms are governed by the laws of India. Disputes are subject to the exclusive jurisdiction of the competent courts at our registered office, without prejudice to applicable consumer-protection forums.',
      'For grievances, contact our Grievance Officer at grievance@shinitz.com before initiating other proceedings.',
    ],
  },
];

export default function TermsScreen() {
  return (
    <LegalDoc
      title="Terms & Conditions"
      updated="20 June 2026"
      intro="Please read these Terms carefully. They set out the rules for using Shinitz and the responsibilities of customers, stores and delivery partners."
      sections={SECTIONS}
    />
  );
}
