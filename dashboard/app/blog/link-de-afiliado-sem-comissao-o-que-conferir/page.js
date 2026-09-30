import { PreservationBlogPost, getPreservationBlogMetadata } from '../_preservationBlogPosts'

export const metadata = getPreservationBlogMetadata('link-de-afiliado-sem-comissao-o-que-conferir')

export default function Page() {
  return <PreservationBlogPost postKey="link-de-afiliado-sem-comissao-o-que-conferir" />
}
