import React, { useState, useEffect } from 'react';
import Landing from './pages/Landing.jsx';
import Presenter from './pages/Presenter.jsx';
import Participant from './pages/Participant.jsx';

export default function App() {
  const [route, setRoute] = useState({ page: 'landing', param: null });

  useEffect(() => {
    const handleRouting = () => {
      const hash = window.location.hash;
      
      if (hash.startsWith('#/presenter/')) {
        const joinCode = hash.replace('#/presenter/', '');
        setRoute({ page: 'presenter', param: joinCode });
      } else if (hash.startsWith('#/vote/')) {
        const joinCode = hash.replace('#/vote/', '');
        setRoute({ page: 'participant', param: joinCode });
      } else {
        setRoute({ page: 'landing', param: null });
      }
    };

    window.addEventListener('hashchange', handleRouting);
    // Execute immediately on mount
    handleRouting();

    return () => window.removeEventListener('hashchange', handleRouting);
  }, []);

  // Simple Page Router
  switch (route.page) {
    case 'presenter':
      return <Presenter joinCode={route.param} />;
    case 'participant':
      return <Participant joinCode={route.param} />;
    case 'landing':
    default:
      return <Landing />;
  }
}
