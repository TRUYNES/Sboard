import React, { useState } from 'react';
import { ExternalLink, Network, Globe } from 'lucide-react';

const PI_IP = '192.168.1.58';

const ServiceCard = ({ service }) => {
  const [imgError, setImgError] = useState(false);

  const getLocalUrl = () => {
    let url = service.service;
    if (url.includes('localhost')) {
      return url.replace('localhost', PI_IP);
    }
    return url;
  };

  const getExternalUrl = () => {
    // If hostname already contains http/https, use it. Otherwise add https://
    // Also handle paths like domain.com/path
    if (service.hostname.startsWith('http')) return service.hostname;
    return `https://${service.hostname}`;
  };

  const localUrl = getLocalUrl();
  const externalUrl = getExternalUrl();

  return (
    <div className="service-card">
      <div className="card-left">
        <div className="service-icon-wrapper">
          {!imgError && service.icon ? (
            <img
              src={service.icon}
              alt={service.name}
              className="service-icon-img"
              onError={() => setImgError(true)}
            />
          ) : (
            <Globe size={24} />
          )}
        </div>
      </div>

      <div className="card-center">
        <h3>{service.name}</h3>
      </div>

      <div className="card-right">
        <a
          href={localUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="action-btn btn-local"
          title="Local Access"
        >
          <Network size={16} />
        </a>
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="action-btn btn-public"
          title="Public Access"
        >
          <ExternalLink size={16} />
        </a>
      </div>
    </div>
  );
};

export default ServiceCard;
