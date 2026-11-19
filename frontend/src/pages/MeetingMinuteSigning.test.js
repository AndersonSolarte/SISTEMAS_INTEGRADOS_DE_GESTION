import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MeetingMinuteSigning from './MeetingMinuteSigning';
import meetingMinuteService from '../services/meetingMinuteService';

jest.mock('react-router-dom', () => ({ useParams: () => ({ token: 'personal-token' }) }));
jest.mock('../services/meetingMinuteService', () => ({
  publicMinute: jest.fn(), sign: jest.fn()
}));
jest.mock('../components/meetingMinute/RichTextEditor', () => ({ sanitizeRichHtml: () => '' }));
jest.mock('../components/meetingMinute/CouncilMinutePreview', () => () => null);
jest.mock('../components/security/GoogleIdentityVerification', () => () => null);

afterEach(() => jest.restoreAllMocks());

test.each(['estudiante', 'egresado', 'externo', 'funcionario'])(
  'permite dibujar y enviar la firma de %s cuando los datos llegan antes de terminar la carga',
  async (kind) => {
    let receiveData;
    let finishLoading;
    meetingMinuteService.publicMinute.mockImplementation(() => ({
      then: (callback) => {
        receiveData = callback;
        return { catch: () => ({ finally: (finish) => { finishLoading = finish; } }) };
      }
    }));
    meetingMinuteService.sign.mockResolvedValue({ success: true });
    const context = { beginPath: jest.fn(), moveTo: jest.fn(), lineTo: jest.fn(), stroke: jest.fn(), arc: jest.fn(), fill: jest.fn(), clearRect: jest.fn() };
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,c2lnbmF0dXJl');
    const { container } = render(<MeetingMinuteSigning />);
    const external = kind !== 'funcionario';
    const person = { id: 'p1', name: 'Persona de prueba', external, email: `${kind}@example.com` };
    act(() => receiveData({ data: {
      code: 'ACTA-TEST', invitation_verified: true, invited_participant_id: person.id,
      participant: person, participants: [person], content: {}, preview_participants: []
    } }));
    expect(container.querySelector('canvas')).toBeNull();
    act(() => finishLoading());
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 30, clientY: 20 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    expect(context.beginPath).toHaveBeenCalled();
    const submit = screen.getByRole('button', { name: 'Confirmar y firmar' });
    if (external) {
      expect(submit).toBeDisabled();
      fireEvent.click(screen.getByRole('checkbox'));
    }
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await waitFor(() => expect(meetingMinuteService.sign).toHaveBeenCalledWith('personal-token', {
      participant_id: 'p1', privacy_accepted: external, signature_data: 'data:image/png;base64,c2lnbmF0dXJl'
    }));
    meetingMinuteService.sign.mockClear();
  }
);
