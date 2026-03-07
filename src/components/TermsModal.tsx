import React from 'react';
import { X } from 'lucide-react';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TermsModal({ isOpen, onClose }: TermsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Terms of Service</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Acceptance of Terms</h3>
            <p className="text-gray-600">
              By accessing and using Scholar Folio, you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Service Description</h3>
            <p className="text-gray-600 mb-4">
              Scholar Folio provides analytics and metrics for Google Scholar profiles. Our service:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Analyzes publicly available academic data</li>
              <li>Calculates citation metrics and research reach</li>
              <li>Visualizes scholarly output and collaboration networks</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">User Responsibilities</h3>
            <p className="text-gray-600 mb-4">Users agree to:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Use the service in compliance with all applicable laws</li>
              <li>Not attempt to circumvent any access restrictions</li>
              <li>Not use the service for unauthorized data collection</li>
              <li>Respect Google Scholar's terms of service</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Intellectual Property</h3>
            <p className="text-gray-600">
              All content, features, and functionality of Scholar Folio are owned by us and are protected by international copyright, trademark, and other intellectual property laws.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Disclaimer</h3>
            <p className="text-gray-600">
              The service is provided "as is" without warranties of any kind. We do not guarantee the accuracy, completeness, or timeliness of any metrics or analysis provided.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Limitation of Liability</h3>
            <p className="text-gray-600">
              We shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Changes to Terms</h3>
            <p className="text-gray-600">
              We reserve the right to modify these terms at any time. Continued use of the service after any changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Contact</h3>
            <p className="text-gray-600">
              For questions about these terms, please contact us at j.heller@maastrichtuniversity.nl
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}