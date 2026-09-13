import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Screen } from '../../design/components';
import { colors, fonts, fontSize, spacing } from '../../design/theme';

type Action = { label: string; onPress: () => void };
export function SiteParityInfoScreen({ title, eyebrow, description, bullets = [], actions = [] }: { title:string; eyebrow?:string; description:string; bullets?:string[]; actions?:Action[] }) {
  return <Screen><ScrollView contentContainerStyle={s.container}>
    {eyebrow ? <Text style={s.eyebrow}>{eyebrow}</Text> : null}
    <Text style={s.title}>{title}</Text>
    <Card><Text style={s.description}>{description}</Text>{bullets.map((x,i)=><View key={i} style={s.row}><Text style={s.dot}>•</Text><Text style={s.bullet}>{x}</Text></View>)}</Card>
    {actions.map((a,i)=><Button key={i} title={a.label} onPress={a.onPress} fullWidth size="lg" />)}
  </ScrollView></Screen>;
}
const s=StyleSheet.create({container:{padding:spacing[5],gap:spacing[4]},eyebrow:{color:colors.gold,fontFamily:fonts.bodySemibold,fontSize:fontSize.sm,textTransform:'uppercase'},title:{color:colors.textPrimary,fontFamily:fonts.brand,fontSize:fontSize['2xl']},description:{color:colors.textSecondary,fontFamily:fonts.body,fontSize:fontSize.base,lineHeight:22},row:{flexDirection:'row',gap:spacing[2],marginTop:spacing[3]},dot:{color:colors.gold,fontSize:18},bullet:{flex:1,color:colors.gray2,fontFamily:fonts.body,lineHeight:20}});
