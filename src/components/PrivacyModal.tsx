import React from 'react';
import { X } from 'lucide-react';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PrivacyModal({ isOpen, onClose }: PrivacyModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Privacy Policy</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Data Collection and Usage</h3>
            <p className="text-gray-600 mb-4">
              Scholar Folio collects and processes only the publicly available data from Google Scholar profiles. We do not store any personal information beyond what is necessary for the application's functionality.
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Profile data is processed in real-time and not permanently stored</li>
              <li>Citation metrics are calculated on-demand</li>
              <li>No tracking cookies are used</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Data Security</h3>
            <p className="text-gray-600 mb-4">
              We implement appropriate security measures to protect your information:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>All data transmission is encrypted using HTTPS</li>
              <li>No sensitive personal data is collected or stored</li>
              <li>Regular security audits are performed</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Third-Party Services</h3>
            <p className="text-gray-600">
              Our service interacts with Google Scholar to retrieve public profile data. We do not share any data with other third parties.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Updates to Privacy Policy</h3>
            <p className="text-gray-600">
              We may update this privacy policy from time to time. Any changes will be posted on this page with an updated revision date.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Contact Us</h3>
            <p className="text-gray-600">
              If you have any questions about our privacy policy, please contact us at j.heller@maastrichtuniversity.nl
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}