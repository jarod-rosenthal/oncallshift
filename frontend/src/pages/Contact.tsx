import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    subject: 'general',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement form submission
    setSubmitted(true);
  };

  const contactOptions = [
    {
      title: 'Sales',
      description: 'Talk to our team about Enterprise plans or custom needs.',
      email: 'sales@oncallshift.com',
      icon: '&#128188;',
    },
    {
      title: 'Support',
      description: 'Get help with your account or technical issues.',
      email: 'support@oncallshift.com',
      icon: '&#128735;',
    },
    {
      title: 'Partnerships',
      description: 'Interested in integrating or partnering with us?',
      email: 'partners@oncallshift.com',
      icon: '&#129309;',
    },
  ];

  return (
    <div className="relative">
      {/* Hero */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-6 text-white">
          Get in Touch
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto">
          Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
        </p>
      </section>

      {/* Contact Options */}
      <section className="container mx-auto px-4 pb-16">
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {contactOptions.map((option, i) => (
            <Card key={i} className="bg-white/[0.03] border border-white/5 rounded-2xl text-center">
              <CardContent className="pt-6">
                <span className="text-3xl block mb-3" dangerouslySetInnerHTML={{ __html: option.icon }} />
                <h3 className="font-semibold mb-2 text-white">{option.title}</h3>
                <p className="text-sm text-slate-400 mb-3">{option.description}</p>
                <a href={`mailto:${option.email}`} className="text-teal-400 text-sm hover:underline">
                  {option.email}
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Contact Form */}
      <section className="bg-white/[0.02] py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <Card className="bg-white/[0.03] border border-white/5 rounded-2xl">
              <CardHeader>
                <CardTitle className="text-white">Send us a message</CardTitle>
              </CardHeader>
              <CardContent>
                {submitted ? (
                  <div className="text-center py-8">
                    <span className="text-4xl block mb-4">&#9989;</span>
                    <h3 className="text-xl font-semibold mb-2 text-white">Message Sent!</h3>
                    <p className="text-slate-400">
                      Thanks for reaching out. We'll get back to you within 1-2 business days.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1 text-slate-300">Name *</label>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-3 py-2 bg-white/[0.05] border border-white/5 rounded-md text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 text-slate-300">Email *</label>
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full px-3 py-2 bg-white/[0.05] border border-white/5 rounded-md text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-300">Company</label>
                      <input
                        type="text"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        className="w-full px-3 py-2 bg-white/[0.05] border border-white/5 rounded-md text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-300">Subject *</label>
                      <select
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        className="w-full px-3 py-2 bg-white/[0.05] border border-white/5 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="general" className="bg-slate-900">General Inquiry</option>
                        <option value="sales" className="bg-slate-900">Sales / Enterprise</option>
                        <option value="support" className="bg-slate-900">Technical Support</option>
                        <option value="partnership" className="bg-slate-900">Partnership</option>
                        <option value="feedback" className="bg-slate-900">Feedback</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-300">Message *</label>
                      <textarea
                        required
                        rows={5}
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        className="w-full px-3 py-2 bg-white/[0.05] border border-white/5 rounded-md text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <Button type="submit" className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950">
                      Send Message
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
