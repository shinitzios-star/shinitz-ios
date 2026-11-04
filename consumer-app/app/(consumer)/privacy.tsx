import React from 'react';
import { LegalDoc, LegalSection } from '../../src/components/LegalDoc';

export const SECTIONS: LegalSection[] = [
  {
    heading: 'About this Policy',
    body: [
      'Shinitz ("Shinitz", "we", "us") operates a hyperlocal quick-commerce and food-delivery platform. This Privacy Policy explains how we collect, use, store, share and protect your personal data when you use our apps and services.',
      'This Policy is published in accordance with the Information Technology Act, 2000 and the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, the Digital Personal Data Protection Act, 2023 (DPDP Act), the Consumer Protection (E-Commerce) Rules, 2020, applicable Reserve Bank of India (RBI) directions on payment data, and Google Play Developer Program Policies.',
    ],
  },
  {
    heading: 'Information We Collect',
    body: [
      'Account & identity data: name, mobile number, email, date of birth and profile photo.',
      'Location data: precise or approximate device location and delivery addresses, used to show nearby stores, calculate delivery distance and route orders.',
      'Order data: items ordered, amounts, delivery instructions (including any voice note you record), and order history.',
      'Device & usage data: device model, OS, app version, IP address, and in-app activity used for security, fraud prevention and improving the service.',
      'Partner data (for delivery and store partners): KYC details such as Aadhaar (where legally required), vehicle and bank/UPI details, and business documents such as FSSAI/GST numbers.',
    ],
  },
  {
    heading: 'How We Use Your Data',
    body: [
      'To create and manage your account, process and deliver your orders, calculate distance-based delivery charges, and provide customer support.',
      'To verify partners, process settlements and payouts, and prevent fraud and abuse.',
      'To send service communications (order updates, OTPs) and, where you consent, promotional messages. You can opt out of promotional messages at any time.',
    ],
  },
  {
    heading: 'Payment Information',
    body: [
      'Payments are processed by RBI-authorised payment gateways and partners. We do not store your full card number, CVV or UPI PIN on our servers.',
      'In line with RBI guidelines, sensitive payment credentials are handled by our PCI-DSS-compliant payment partners; we retain only limited transaction references needed for order history, refunds and reconciliation.',
    ],
  },
  {
    heading: 'Cookies & Similar Technologies',
    body: [
      'Our web surfaces use cookies and local storage to keep you signed in, remember preferences and measure performance. You can control cookies through your browser settings; disabling essential cookies may limit functionality.',
      'Our mobile apps use device identifiers and local storage for equivalent purposes.',
    ],
  },
  {
    heading: 'Data Storage & Security',
    body: [
      'Your data is stored on secured cloud infrastructure with access controls, encryption in transit (HTTPS/TLS) and encryption of sensitive fields at rest. Voice delivery notes are stored encrypted and accessible only to the assigned delivery partner, the fulfilling store and authorised staff for the duration of the order.',
      'We follow reasonable security practices under the IT Act and DPDP Act. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.',
    ],
  },
  {
    heading: 'Sharing Your Data',
    body: [
      'We share order and delivery details with the relevant store and delivery partner strictly to fulfil your order. We share data with payment processors, communication providers (SMS/push) and analytics/security providers under contract.',
      'We may disclose data to law-enforcement or regulators where required by law. We do not sell your personal data.',
    ],
  },
  {
    heading: 'Your Rights (DPDP Act, 2023)',
    body: [
      'You have the right to access, correct and update your personal data, to withdraw consent, to nominate, and to grievance redressal.',
      'You may exercise these rights in-app or by contacting our Grievance Officer below.',
    ],
  },
  {
    heading: 'Account Deletion',
    body: [
      'You may request deletion of your account at any time from Profile → Delete Account, or by emailing grievance@shinitz.com from your registered email/number.',
      'When you confirm a deletion request, your account is deactivated immediately and scheduled for permanent deletion after 30 days. During this 30-day period you can log in at any time to restore your account with no loss of data.',
      'After the 30-day period, your personal information is permanently deleted or irreversibly anonymised. Certain records — such as completed orders, invoices, tax records and financial transactions — are retained in anonymised form for the period required by tax, accounting, fraud-prevention, legal and regulatory obligations.',
      'This process follows the Google Play Account Deletion policy, GDPR principles and the Digital Personal Data Protection Act, 2023 (DPDP Act).',
    ],
  },
  {
    heading: 'Data Retention',
    body: [
      'We retain personal data only as long as needed for the purposes described here or as required by applicable law. Transaction and invoice records are retained for the period mandated by tax and financial regulations. Voice delivery notes are deleted after the order lifecycle and a short dispute window.',
    ],
  },
  {
    heading: 'Children',
    body: [
      'The service is intended for users aged 18 and above. We do not knowingly collect data from children. Where required, processing of a child’s data is done only with verifiable parental consent as per the DPDP Act.',
    ],
  },
  {
    heading: 'Changes & Contact',
    body: [
      'We may update this Policy and will notify material changes in-app. Continued use after changes constitutes acceptance.',
      'Grievance Officer: grievance@shinitz.com. Support: support@shinitz.com, 9971500988 / 8700871677.',
    ],
  },
];

export default function PrivacyScreen() {
  return (
    <LegalDoc
      title="Privacy Policy"
      updated="20 June 2026"
      intro="Your privacy matters to us. This Policy describes what data Shinitz collects, why, how we protect it, and the choices and rights you have."
      sections={SECTIONS}
    />
  );
}
