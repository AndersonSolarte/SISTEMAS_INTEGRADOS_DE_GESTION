const PRIVACY_POLICY_VERSION = 'LEY-1581-2012-DEC-1074-2015';
const PRIVACY_POLICY_URL = 'https://www.unicesmag.edu.co/documentos/DATOS-UNICESMAG.pdf';
const PRIVACY_POLICY_PARAGRAPHS = [
  'En la Universidad CESMAG, tratamos sus datos personales conforme a la Ley 1581 de 2012 y el Decreto 1074 de 2015. El tratamiento de sus datos incluye la recolección, almacenamiento, uso, circulación y supresión de la información. La finalidad de este tratamiento comprende, pero no se limita a gestión de procesos académicos, financieros, administrativos, de investigación, proyección social y de recursos humanos, desarrollo de programas de bienestar y desarrollo estudiantil, seguridad y control de acceso, cumplimiento de obligaciones legales. En algunos casos, podríamos solicitar datos personales sensibles.',
  `Usted tiene derecho a conocer, actualizar, rectificar y suprimir sus datos personales, así como a revocar la autorización otorgada para su tratamiento en los términos de la normativa vigente. Para más información sobre nuestras políticas de tratamiento de datos personales y sus cambios sustanciales, visite: ${PRIVACY_POLICY_URL}`,
  'Para ejercer estos derechos o si tiene alguna pregunta sobre este aviso de privacidad o sobre el tratamiento de sus datos personales, contáctenos a través del correo correspondencia@unicesmag.edu.co, o presencialmente en las instalaciones de la Universidad CESMAG (Campus Centro), ubicada en la Carrera 20 A No. 14-54 de la ciudad de Pasto.'
];
const PRIVACY_POLICY_NOTICE = PRIVACY_POLICY_PARAGRAPHS.join('\n\n');

module.exports = {
  PRIVACY_POLICY_NOTICE,
  PRIVACY_POLICY_PARAGRAPHS,
  PRIVACY_POLICY_URL,
  PRIVACY_POLICY_VERSION
};
